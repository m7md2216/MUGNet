#!/usr/bin/env python3
"""
Question Evaluator - Automated evaluation tool for conversational memory systems
Upload your questions, get AI responses, download results
"""

import csv
import json
import requests
import time
import os
from datetime import datetime
from typing import Dict, List, Tuple, Optional

class QuestionEvaluator:
    def __init__(self, base_url: str = "http://localhost:5000"):
        self.base_url = base_url
        self.results = []
        
    def load_questions_from_csv(self, file_path: str) -> List[Dict]:
        """Load evaluation questions from CSV file"""
        questions = []
        
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                # Try to detect the delimiter
                sample = f.read(1024)
                f.seek(0)
                
                delimiter = ','
                if '\t' in sample:
                    delimiter = '\t'
                
                reader = csv.DictReader(f, delimiter=delimiter)
                
                for row in reader:
                    # Handle different column name variations
                    question = (row.get('Prompt') or 
                              row.get('Question') or 
                              row.get('prompt') or 
                              row.get('question') or '').strip()
                    
                    ground_truth = (row.get('Ground Truth Answer') or 
                                  row.get('Answer') or 
                                  row.get('ground_truth') or 
                                  row.get('answer') or '').strip()
                    
                    memory_type = (row.get('Memory Type') or 
                                 row.get('Type') or 
                                 row.get('memory_type') or 
                                 row.get('type') or 'Unknown').strip()
                    
                    if question and ground_truth:
                        questions.append({
                            'prompt': question,
                            'ground_truth': ground_truth,
                            'memory_type': memory_type
                        })
                
            print(f"📊 Loaded {len(questions)} questions from {file_path}")
            return questions
            
        except FileNotFoundError:
            print(f"❌ File not found: {file_path}")
            return []
        except Exception as e:
            print(f"❌ Error loading questions: {e}")
            return []
    
    def load_questions_from_txt(self, file_path: str) -> List[Dict]:
        """Load questions from text file (simple format)"""
        questions = []
        
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                lines = f.readlines()
            
            current_question = None
            current_answer = None
            
            for line in lines:
                line = line.strip()
                if not line or line.startswith('#'):
                    continue
                
                if line.startswith('Q:') or line.startswith('Question:'):
                    if current_question and current_answer:
                        questions.append({
                            'prompt': current_question,
                            'ground_truth': current_answer,
                            'memory_type': 'Manual Entry'
                        })
                    current_question = line.split(':', 1)[1].strip()
                    current_answer = None
                
                elif line.startswith('A:') or line.startswith('Answer:'):
                    current_answer = line.split(':', 1)[1].strip()
            
            # Add the last question
            if current_question and current_answer:
                questions.append({
                    'prompt': current_question,
                    'ground_truth': current_answer,
                    'memory_type': 'Manual Entry'
                })
            
            print(f"📊 Loaded {len(questions)} questions from {file_path}")
            return questions
            
        except Exception as e:
            print(f"❌ Error loading questions: {e}")
            return []
    
    def ask_ai_question(self, question: str, max_retries: int = 3) -> str:
        """Ask the AI a question and get response"""
        
        for attempt in range(max_retries):
            try:
                # Format question for the AI system (assuming Emma as the default user)
                message_data = {
                    'userId': 5,  # Emma's ID (adjust if needed)
                    'content': f"@AI Agent {question}"
                }
                
                response = requests.post(
                    f"{self.base_url}/api/messages", 
                    json=message_data,
                    timeout=30  # 30 second timeout
                )
                
                if response.status_code in [200, 201]:
                    # Get AI response from messages endpoint
                    time.sleep(2)  # Longer pause for AI processing
                    
                    messages_response = requests.get(f"{self.base_url}/api/messages")
                    if messages_response.status_code == 200:
                        messages = messages_response.json()
                        
                        # Find the most recent AI response
                        for message in reversed(messages):
                            # Check both isAI flag and userId (AI Agent has userId = 1)
                            if message.get('isAI', False) or message.get('userId') == 1:  # AI Agent user ID
                                return message.get('content', 'No response content')
                        
                        return "No AI response found"
                    else:
                        return f"Error retrieving messages: {messages_response.status_code}"
                else:
                    print(f"❌ Request failed (attempt {attempt + 1}): {response.status_code}")
                    if attempt < max_retries - 1:
                        time.sleep(2 ** attempt)  # Exponential backoff
                    
            except requests.exceptions.Timeout:
                print(f"⏰ Timeout on attempt {attempt + 1}")
                if attempt < max_retries - 1:
                    time.sleep(2 ** attempt)
            except Exception as e:
                print(f"❌ Error on attempt {attempt + 1}: {e}")
                if attempt < max_retries - 1:
                    time.sleep(2 ** attempt)
        
        return f"Error: Failed after {max_retries} attempts"
    
    def find_latest_intermediate_file(self) -> Optional[str]:
        """Find the most recent intermediate results file"""
        import glob
        
        intermediate_files = glob.glob("question_evaluation_intermediate_*of*.json")
        if not intermediate_files:
            return None
        
        # Sort by modification time, get most recent
        latest_file = max(intermediate_files, key=os.path.getmtime)
        return latest_file
    
    def load_intermediate_results(self, filename: str) -> Tuple[List[Dict], int]:
        """Load results from intermediate file"""
        try:
            with open(filename, 'r', encoding='utf-8') as f:
                data = json.load(f)
            
            results = data.get('detailed_results', [])
            completed_count = len(results)
            
            print(f"📂 Loaded {completed_count} completed questions from {filename}")
            return results, completed_count
            
        except Exception as e:
            print(f"❌ Error loading intermediate file: {e}")
            return [], 0

    def save_intermediate_results(self, results: List[Dict], questions_count: int, current_question: int) -> str:
        """Save intermediate results to prevent data loss"""
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"question_evaluation_intermediate_{current_question}of{questions_count}_{timestamp}.json"
        
        intermediate_report = {
            'evaluation_metadata': {
                'evaluation_timestamp': datetime.now().isoformat(),
                'questions_completed': current_question,
                'total_questions': questions_count,
                'progress_percentage': (current_question / questions_count) * 100,
                'is_intermediate': True
            },
            'detailed_results': results
        }
        
        with open(filename, 'w', encoding='utf-8') as f:
            json.dump(intermediate_report, f, indent=2, ensure_ascii=False)
        
        print(f"💾 Saved intermediate results: {filename}")
        return filename

    def evaluate_questions(self, questions_file: str, delay_between_questions: float = 2.0) -> Dict:
        """Evaluate all questions and generate results"""
        
        print("🧪 QUESTION EVALUATOR")
        print("=" * 50)
        
        # Check for existing intermediate results
        latest_intermediate = self.find_latest_intermediate_file()
        results = []
        start_question = 1
        
        if latest_intermediate:
            print(f"🔍 Found intermediate results: {latest_intermediate}")
            resume_choice = input("Do you want to resume from where you left off? (y/n): ").strip().lower()
            
            if resume_choice in ['y', 'yes']:
                results, completed_count = self.load_intermediate_results(latest_intermediate)
                start_question = completed_count + 1
                print(f"🔄 Resuming from question {start_question}")
            else:
                print("🆕 Starting fresh evaluation")
        
        # Determine file type and load questions
        if questions_file.endswith('.csv'):
            questions = self.load_questions_from_csv(questions_file)
        else:
            questions = self.load_questions_from_txt(questions_file)
        
        if not questions:
            print("❌ No questions loaded")
            return {}
        
        if start_question > len(questions):
            print(f"✅ All {len(questions)} questions already completed!")
            # Generate final report from existing results
            total_time = 0  # We don't have timing info from loaded results
            error_count = sum(1 for r in results if r['contains_error'])
            success_count = len(results) - error_count
            
            report = {
                'evaluation_metadata': {
                    'evaluation_timestamp': datetime.now().isoformat(),
                    'source_file': questions_file,
                    'total_questions': len(questions),
                    'successful_responses': success_count,
                    'error_responses': error_count,
                    'success_rate': (success_count / len(questions)) * 100,
                    'total_evaluation_time_seconds': total_time,
                    'average_time_per_question': 0,
                    'resumed_from_intermediate': True
                },
                'question_breakdown': {
                    memory_type: len([q for q in questions if q['memory_type'] == memory_type])
                    for memory_type in set(q['memory_type'] for q in questions)
                },
                'detailed_results': results
            }
            return report
        
        print(f"🎯 Evaluating questions {start_question} to {len(questions)} ({len(questions) - start_question + 1} remaining)")
        print(f"⏱️  Estimated time: {(len(questions) - start_question + 1) * (delay_between_questions + 5)} seconds")
        print(f"💾 Saving intermediate results every 5 questions")
        print("=" * 50)
        
        start_time = time.time()
        
        for i in range(start_question - 1, len(questions)):
            question_num = i + 1
            question = questions[i]
            
            print(f"\n📋 Question {question_num}/{len(questions)}")
            print(f"❓ {question['prompt'][:60]}...")
            
            # Ask the AI
            ai_response = self.ask_ai_question(question['prompt'])
            
            # Store result
            result = {
                'question_number': question_num,
                'prompt': question['prompt'],
                'memory_type': question['memory_type'],
                'ground_truth': question['ground_truth'],
                'ai_response': ai_response,
                'timestamp': datetime.now().isoformat(),
                'response_length': len(ai_response),
                'contains_error': 'Error:' in ai_response or 'timeout' in ai_response.lower()
            }
            
            results.append(result)
            
            # Show preview
            if not result['contains_error']:
                print(f"✅ AI: {ai_response[:80]}...")
            else:
                print(f"❌ Error: {ai_response}")
            
            # Progress update
            elapsed = time.time() - start_time
            questions_processed = question_num - start_question + 1
            avg_time_per_question = elapsed / questions_processed if questions_processed > 0 else 0
            remaining_questions = len(questions) - question_num
            eta = remaining_questions * avg_time_per_question
            
            if question_num % 5 == 0 or question_num == len(questions):
                print(f"📊 Progress: {question_num}/{len(questions)} ({(question_num/len(questions))*100:.1f}%) - ETA: {eta/60:.1f} minutes")
                
                # Save intermediate results every 5 questions
                if question_num % 5 == 0 and question_num < len(questions):
                    self.save_intermediate_results(results, len(questions), question_num)
            
            # Delay between questions
            if question_num < len(questions) and delay_between_questions > 0:
                time.sleep(delay_between_questions)
        
        # Generate evaluation report
        total_time = time.time() - start_time
        error_count = sum(1 for r in results if r['contains_error'])
        success_count = len(results) - error_count
        
        report = {
            'evaluation_metadata': {
                'evaluation_timestamp': datetime.now().isoformat(),
                'source_file': questions_file,
                'total_questions': len(questions),
                'successful_responses': success_count,
                'error_responses': error_count,
                'success_rate': (success_count / len(questions)) * 100,
                'total_evaluation_time_seconds': total_time,
                'average_time_per_question': total_time / len(questions)
            },
            'question_breakdown': {
                memory_type: len([q for q in questions if q['memory_type'] == memory_type])
                for memory_type in set(q['memory_type'] for q in questions)
            },
            'detailed_results': results
        }
        
        print(f"\n🎯 EVALUATION COMPLETE")
        print(f"✅ Successful responses: {success_count}/{len(questions)} ({(success_count/len(questions))*100:.1f}%)")
        print(f"❌ Error responses: {error_count}")
        print(f"⏱️  Total time: {total_time/60:.1f} minutes")
        
        # Save final results immediately
        json_file, csv_file = self.save_results(report)
        print(f"💾 Final results auto-saved: {json_file}")
        
        return report
    
    def save_results(self, report: Dict) -> Tuple[str, str]:
        """Save results in both JSON and CSV formats"""
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        
        # Save JSON report
        json_filename = f"question_evaluation_results_{timestamp}.json"
        with open(json_filename, 'w', encoding='utf-8') as f:
            json.dump(report, f, indent=2, ensure_ascii=False)
        
        # Save CSV for easy analysis
        csv_filename = f"question_evaluation_results_{timestamp}.csv"
        with open(csv_filename, 'w', newline='', encoding='utf-8') as f:
            writer = csv.writer(f)
            
            # Headers
            writer.writerow([
                'Question Number',
                'Memory Type', 
                'Question',
                'Ground Truth',
                'AI Response',
                'Response Length',
                'Contains Error',
                'Timestamp'
            ])
            
            # Data rows
            for result in report['detailed_results']:
                writer.writerow([
                    result['question_number'],
                    result['memory_type'],
                    result['prompt'],
                    result['ground_truth'],
                    result['ai_response'],
                    result['response_length'],
                    result['contains_error'],
                    result['timestamp']
                ])
        
        return json_filename, csv_filename

def main():
    """Main function - configure your questions file here"""
    
    # 🔧 CONFIGURATION - Change this to your questions file
    questions_file = "example_questions.txt"  # Change this path!
    
    print("🧪 QUESTION EVALUATOR TOOL")
    print("=" * 60)
    print("🔧 To use this tool:")
    print("1. Create a questions file (CSV or TXT format)")
    print("2. Update the 'questions_file' variable above")
    print("3. Run this script")
    print("")
    print("📝 Supported CSV format:")
    print("   Prompt,Memory Type,Ground Truth Answer")
    print("   Who likes chocolate?,Preference,Sarah")
    print("")
    print("📝 Supported TXT format:")
    print("   Q: Who likes chocolate?")
    print("   A: Sarah")
    print("=" * 60)
    
    evaluator = QuestionEvaluator()
    
    # Check if questions file exists
    if not os.path.exists(questions_file):
        print(f"❌ Questions file not found: {questions_file}")
        print("📝 Please create a questions file in one of the supported formats")
        
        # Create example files
        print("\n💡 Creating example files for you...")
        
        # Example CSV
        with open("example_questions.csv", "w", newline='', encoding='utf-8') as f:
            writer = csv.writer(f)
            writer.writerow(["Prompt", "Memory Type", "Ground Truth Answer"])
            writer.writerow(["Who went camping?", "Factual Recall", "Jake"])
            writer.writerow(["What does Emma like to eat?", "Preference", "Burritos with hot sauce"])
            writer.writerow(["Which TV show did the group discuss?", "Event Memory", "Galactic Heist Chronicles"])
        
        print("✅ Created example_questions.csv")
        
        # Example TXT
        with open("example_questions.txt", "w", encoding='utf-8') as f:
            f.write("Q: Who went camping?\n")
            f.write("A: Jake\n\n")
            f.write("Q: What does Emma like to eat?\n")
            f.write("A: Burritos with hot sauce\n\n")
            f.write("Q: Which TV show did the group discuss?\n")
            f.write("A: Galactic Heist Chronicles\n")
        
        print("✅ Created example_questions.txt")
        print("🔧 Update the questions_file variable to use one of these examples")
        return
    
    # Run evaluation
    report = evaluator.evaluate_questions(questions_file)
    
    if report:
        # Save results
        json_file, csv_file = evaluator.save_results(report)
        
        print(f"\n💾 RESULTS SAVED:")
        print(f"📊 Detailed report: {json_file}")
        print(f"📈 CSV for analysis: {csv_file}")
        print(f"\n📥 Both files are ready for download!")
        
        # Summary statistics
        metadata = report['evaluation_metadata']
        print(f"\n📋 SUMMARY:")
        print(f"   Total Questions: {metadata['total_questions']}")
        print(f"   Success Rate: {metadata['success_rate']:.1f}%")
        print(f"   Average Time per Question: {metadata['average_time_per_question']:.1f}s")
        
    else:
        print("❌ Evaluation failed")

if __name__ == "__main__":
    main()