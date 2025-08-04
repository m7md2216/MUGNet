#!/usr/bin/env python3
"""
Automated AI Agent Evaluation System
Asks questions one by one, handles API limits with retries, stores all responses.
Uses full system capabilities (knowledge graph + conversation history + AI reasoning).
"""

import csv
import json
import requests
import time
import re
from datetime import datetime
from typing import Dict, List, Tuple, Optional

class ResilientAIEvaluator:
    def __init__(self, base_url: str = "http://localhost:5000"):
        self.base_url = base_url
        self.results = []
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
    def ask_ai_with_retry(self, question: str, max_retries: int = 5) -> Tuple[str, bool]:
        """Ask AI agent with exponential backoff retry logic"""
        formatted_question = f"@AI Agent {question}"
        
        for attempt in range(max_retries):
            try:
                payload = {
                    "content": formatted_question,
                    "mentions": ["AI Agent"],
                    "userId": 5  # Emma's user ID
                }
                
                print(f"  💬 Asking: {question}")
                if attempt > 0:
                    print(f"    🔄 Retry attempt {attempt}")
                
                response = self.session.post(
                    f"{self.base_url}/api/messages",
                    json=payload,
                    timeout=30
                )
                
                if response.status_code == 200:
                    data = response.json()
                    ai_response = data.get("aiResponse", {}).get("content", "")
                    
                    if ai_response and "having trouble responding" not in ai_response.lower():
                        print(f"    ✅ Got response: {ai_response[:80]}...")
                        return ai_response, True
                    else:
                        print(f"    ⚠️  Empty or error response, retrying...")
                        
                elif response.status_code == 429:  # Rate limit
                    retry_after = int(response.headers.get('retry-after', 2))
                    print(f"    ⏳ Rate limited, waiting {retry_after + 1} seconds...")
                    time.sleep(retry_after + 1)
                    continue
                    
                else:
                    print(f"    ❌ HTTP {response.status_code}, retrying...")
                    
            except requests.exceptions.RequestException as e:
                print(f"    🔌 Connection error: {str(e)[:50]}..., retrying...")
                
            # Exponential backoff
            wait_time = (2 ** attempt) + 1
            print(f"    ⏸️  Waiting {wait_time}s before retry...")
            time.sleep(wait_time)
        
        return f"Failed after {max_retries} attempts", False
    
    def evaluate_semantic_match(self, ground_truth: str, ai_response: str) -> Tuple[bool, str, float]:
        """Enhanced semantic matching with detailed reasoning"""
        if not ai_response or "failed after" in ai_response.lower():
            return False, "No valid response", 0.0
            
        # Clean and normalize
        truth_clean = re.sub(r'[^\w\s]', '', ground_truth.lower()).strip()
        response_clean = re.sub(r'[^\w\s]', '', ai_response.lower()).strip()
        
        # Remove AI formatting
        response_clean = re.sub(r'^(hey \w+\s*according to.*?)', '', response_clean)
        response_clean = re.sub(r'\s*😊\s*$', '', response_clean)
        response_clean = response_clean.strip()
        
        # Exact substring match
        if truth_clean in response_clean:
            return True, "Exact substring match", 1.0
        
        # Word-level analysis
        truth_words = set(word for word in truth_clean.split() if len(word) > 2)
        response_words = set(word for word in response_clean.split() if len(word) > 2)
        
        # Remove common stop words
        stop_words = {'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'is', 'was', 'are', 'were', 'has', 'had', 'have', 'his', 'her', 'their', 'this', 'that', 'they', 'them', 'will', 'would', 'could', 'should'}
        truth_key_words = truth_words - stop_words
        response_key_words = response_words - stop_words
        
        if not truth_key_words:
            return True, "Only common words in ground truth", 0.8
            
        # Calculate semantic overlap
        overlap = truth_key_words.intersection(response_key_words)
        overlap_ratio = len(overlap) / len(truth_key_words) if truth_key_words else 0
        
        # Semantic equivalence checks
        semantic_pairs = [
            (['terrified', 'afraid'], ['phobia', 'scared', 'fearful', 'frightened']),
            (['dislikes', 'hates'], ['doesnt', 'like', 'not', 'fan']),
            (['enjoys', 'likes'], ['prefers', 'loves', 'into']),
            (['nervous', 'anxious'], ['worried', 'stressed', 'concerned']),
        ]
        
        semantic_bonus = 0
        for truth_synonyms, response_synonyms in semantic_pairs:
            if (any(word in truth_clean for word in truth_synonyms) and 
                any(word in response_clean for word in response_synonyms)):
                semantic_bonus += 0.3
        
        total_score = min(1.0, overlap_ratio + semantic_bonus)
        
        # Scoring thresholds
        if total_score >= 0.9:
            return True, f"Excellent match ({len(overlap)}/{len(truth_key_words)} + semantic)", total_score
        elif total_score >= 0.7:
            return True, f"Good match ({len(overlap)}/{len(truth_key_words)} + semantic)", total_score
        elif total_score >= 0.5:
            return True, f"Acceptable match ({len(overlap)}/{len(truth_key_words)} + partial semantic)", total_score
        elif total_score >= 0.3:
            return False, f"Weak match ({len(overlap)}/{len(truth_key_words)})", total_score
        else:
            return False, "No meaningful match", total_score
    
    def run_evaluation(self, questions_file: str, output_file: str = None) -> Dict:
        """Run complete evaluation with progress tracking"""
        
        # Load questions
        questions = []
        with open(questions_file, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            questions = list(reader)
        
        if output_file is None:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            output_file = f"evaluation_results_{timestamp}.json"
        
        print("🚀 AUTOMATED AI AGENT EVALUATION")
        print("=" * 60)
        print(f"📊 Total Questions: {len(questions)}")
        print(f"🎯 Target System: Full AI capabilities (KG + History + Reasoning)")
        print(f"💾 Output File: {output_file}")
        print(f"⏰ Started: {datetime.now().strftime('%H:%M:%S')}")
        print("=" * 60)
        
        start_time = time.time()
        correct_count = 0
        
        for i, question in enumerate(questions, 1):
            print(f"\n📋 Question {i}/{len(questions)}")
            print(f"🔍 Type: {question['Memory Type']}")
            
            # Ask the question with retry logic
            ai_response, success = self.ask_ai_with_retry(question['Prompt'])
            
            # Evaluate the response
            is_correct, match_reason, confidence = self.evaluate_semantic_match(
                question['Ground Truth Answer'], 
                ai_response
            )
            
            if is_correct:
                correct_count += 1
                print(f"    ✅ CORRECT ({match_reason}, conf: {confidence:.2f})")
            else:
                print(f"    ❌ INCORRECT ({match_reason}, conf: {confidence:.2f})")
            
            # Store result
            result = {
                'question_number': i,
                'prompt': question['Prompt'],
                'memory_type': question['Memory Type'],
                'ground_truth': question['Ground Truth Answer'],
                'ai_response': ai_response,
                'response_success': success,
                'evaluation_correct': is_correct,
                'match_reason': match_reason,
                'confidence_score': confidence,
                'timestamp': datetime.now().isoformat()
            }
            self.results.append(result)
            
            # Progress update
            current_accuracy = (correct_count / i) * 100
            elapsed = time.time() - start_time
            avg_time_per_question = elapsed / i
            estimated_remaining = avg_time_per_question * (len(questions) - i)
            
            print(f"    📊 Running Accuracy: {current_accuracy:.1f}% ({correct_count}/{i})")
            print(f"    ⏱️  Avg Time/Question: {avg_time_per_question:.1f}s")
            print(f"    🕒 Est. Remaining: {estimated_remaining/60:.1f}min")
            
            # Small delay to avoid overwhelming the system
            time.sleep(1)
        
        # Final results
        total_time = time.time() - start_time
        final_accuracy = (correct_count / len(questions)) * 100
        
        print("\n" + "=" * 60)
        print("🎯 EVALUATION COMPLETE!")
        print("=" * 60)
        print(f"⏱️  Total Time: {total_time/60:.1f} minutes")
        print(f"📊 Total Questions: {len(questions)}")
        print(f"✅ Correct Answers: {correct_count}")
        print(f"🎯 Final Accuracy: {final_accuracy:.2f}%")
        print(f"⚡ Avg Speed: {total_time/len(questions):.1f}s per question")
        
        # Memory type breakdown
        memory_stats = {}
        for result in self.results:
            mem_type = result['memory_type']
            if mem_type not in memory_stats:
                memory_stats[mem_type] = {'total': 0, 'correct': 0, 'confidence_sum': 0}
            memory_stats[mem_type]['total'] += 1
            if result['evaluation_correct']:
                memory_stats[mem_type]['correct'] += 1
            memory_stats[mem_type]['confidence_sum'] += result['confidence_score']
        
        print(f"\n📈 Results by Memory Type:")
        for mem_type, stats in memory_stats.items():
            accuracy = (stats['correct'] / stats['total']) * 100
            avg_conf = stats['confidence_sum'] / stats['total']
            print(f"  {mem_type}: {stats['correct']}/{stats['total']} ({accuracy:.1f}%, avg conf: {avg_conf:.2f})")
        
        # Save comprehensive results
        evaluation_summary = {
            'evaluation_metadata': {
                'total_questions': len(questions),
                'correct_answers': correct_count,
                'final_accuracy_percentage': final_accuracy,
                'total_time_minutes': total_time / 60,
                'avg_time_per_question_seconds': total_time / len(questions),
                'evaluation_timestamp': datetime.now().isoformat(),
                'system_configuration': 'Full AI capabilities (Knowledge Graph + Conversation History + GPT-4o Reasoning)'
            },
            'memory_type_breakdown': {
                mem_type: {
                    'total_questions': stats['total'],
                    'correct_answers': stats['correct'],
                    'accuracy_percentage': (stats['correct'] / stats['total']) * 100,
                    'average_confidence': stats['confidence_sum'] / stats['total']
                }
                for mem_type, stats in memory_stats.items()
            },
            'detailed_results': self.results,
            'sample_correct_answers': [r for r in self.results if r['evaluation_correct']][:5],
            'sample_incorrect_answers': [r for r in self.results if not r['evaluation_correct']][:5]
        }
        
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(evaluation_summary, f, indent=2, ensure_ascii=False)
        
        print(f"\n💾 Detailed results saved to: {output_file}")
        
        return evaluation_summary

def main():
    """Main execution function"""
    evaluator = ResilientAIEvaluator()
    
    # Use the latest attached questions file
    questions_file = 'attached_assets/Pasted-Prompt-Memory-Type-Ground-Truth-Answer-Who-encountered-a-bear-during-a-camping-trip-Factual-Recall--1754319460900_1754319460901.txt'
    
    try:
        results = evaluator.run_evaluation(questions_file)
        print(f"\n🎉 Evaluation completed successfully!")
        print(f"📊 Final Accuracy: {results['evaluation_metadata']['final_accuracy_percentage']:.2f}%")
        return results
    except Exception as e:
        print(f"\n❌ Evaluation failed: {e}")
        return None

if __name__ == "__main__":
    main()