#!/usr/bin/env python3
"""
Fast evaluation script for AI agent factual accuracy.
Uses concurrent requests and optimized matching for rapid testing.
"""

import csv
import json
import requests
import time
import re
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import Dict, List, Tuple
import threading

class FastAIEvaluator:
    def __init__(self, base_url: str = "http://localhost:5000", max_workers: int = 5):
        self.base_url = base_url
        self.max_workers = max_workers
        self.results = []
        self.lock = threading.Lock()
        
    def ask_ai_agent(self, question: str, question_id: int) -> Tuple[int, str, str]:
        """Send question to AI agent and get response"""
        try:
            formatted_question = f"@AI Agent {question}"
            payload = {
                "content": formatted_question,
                "mentions": ["AI Agent"],
                "userId": 5  # Emma's user ID
            }
            
            response = requests.post(
                f"{self.base_url}/api/messages",
                json=payload,
                headers={"Content-Type": "application/json"},
                timeout=20
            )
            
            if response.status_code == 200:
                data = response.json()
                ai_response = data.get("aiResponse", {}).get("content", "")
                return question_id, question, ai_response
            else:
                return question_id, question, f"HTTP Error {response.status_code}"
                
        except Exception as e:
            return question_id, question, f"Error: {str(e)}"
    
    def smart_match(self, ground_truth: str, ai_response: str) -> Tuple[bool, str, float]:
        """Enhanced matching with confidence scores"""
        if not ai_response or "having trouble responding" in ai_response.lower():
            return False, "No valid response", 0.0
            
        # Normalize both strings
        truth_clean = re.sub(r'[^\w\s]', '', ground_truth.lower()).strip()
        response_clean = re.sub(r'[^\w\s]', '', ai_response.lower()).strip()
        
        # Remove AI pleasantries
        response_clean = re.sub(r'^(hey \w+\s+according to the knowledge graph\s*)', '', response_clean)
        response_clean = re.sub(r'\s+😊$', '', response_clean)
        
        # Exact substring match
        if truth_clean in response_clean:
            return True, "Exact match", 1.0
        
        # Key terms matching with weights
        truth_words = set(truth_clean.split())
        response_words = set(response_clean.split())
        
        # Remove common words
        stop_words = {'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'is', 'was', 'are', 'were', 'he', 'she', 'they', 'his', 'her', 'their'}
        truth_words_filtered = truth_words - stop_words
        response_words_filtered = response_words - stop_words
        
        if not truth_words_filtered:  # Only stop words in ground truth
            return True, "Trivial match", 0.8
            
        # Calculate overlap
        overlap = truth_words_filtered.intersection(response_words_filtered)
        overlap_ratio = len(overlap) / len(truth_words_filtered)
        
        # Special handling for names and specific terms
        if overlap_ratio >= 0.8:
            return True, f"Strong match ({len(overlap)}/{len(truth_words_filtered)} key words)", overlap_ratio
        elif overlap_ratio >= 0.6:
            return True, f"Good match ({len(overlap)}/{len(truth_words_filtered)} key words)", overlap_ratio
        elif overlap_ratio >= 0.4:
            return False, f"Partial match ({len(overlap)}/{len(truth_words_filtered)} key words)", overlap_ratio
        else:
            return False, "Weak match", overlap_ratio
    
    def evaluate_batch(self, questions: List[Dict]) -> Dict:
        """Evaluate questions in parallel batches"""
        print(f"🚀 Starting Fast AI Agent Evaluation")
        print(f"📊 Testing {len(questions)} questions with {self.max_workers} concurrent workers")
        print("=" * 70)
        
        start_time = time.time()
        
        # Prepare questions for threading
        question_tasks = [(i, q['Prompt'], q['Memory Type'], q['Ground Truth Answer']) 
                         for i, q in enumerate(questions, 1)]
        
        completed_count = 0
        
        # Process in batches to avoid overwhelming the server
        with ThreadPoolExecutor(max_workers=self.max_workers) as executor:
            # Submit all tasks
            future_to_question = {
                executor.submit(self.ask_ai_agent, prompt, i): (i, prompt, mem_type, truth)
                for i, prompt, mem_type, truth in question_tasks
            }
            
            # Process completed requests
            for future in as_completed(future_to_question):
                question_id, prompt, mem_type, ground_truth = future_to_question[future]
                
                try:
                    _, _, ai_response = future.result()
                    
                    # Evaluate response
                    is_correct, match_reason, confidence = self.smart_match(ground_truth, ai_response)
                    
                    with self.lock:
                        completed_count += 1
                        self.results.append({
                            'question_id': question_id,
                            'prompt': prompt,
                            'memory_type': mem_type,
                            'ground_truth': ground_truth,
                            'ai_response': ai_response,
                            'correct': is_correct,
                            'match_reason': match_reason,
                            'confidence': confidence
                        })
                        
                        # Progress indicator
                        if completed_count % 10 == 0 or completed_count == len(questions):
                            elapsed = time.time() - start_time
                            rate = completed_count / elapsed if elapsed > 0 else 0
                            print(f"✅ Progress: {completed_count}/{len(questions)} ({rate:.1f} q/sec)")
                
                except Exception as e:
                    print(f"❌ Error processing question {question_id}: {e}")
        
        # Sort results by question ID
        self.results.sort(key=lambda x: x['question_id'])
        
        # Calculate metrics
        total_questions = len(self.results)
        correct_answers = sum(1 for r in self.results if r['correct'])
        accuracy = (correct_answers / total_questions) * 100 if total_questions > 0 else 0
        
        elapsed_time = time.time() - start_time
        
        print("\n" + "=" * 70)
        print("🎯 FAST EVALUATION RESULTS")
        print("=" * 70)
        print(f"⏱️  Total Time: {elapsed_time:.1f} seconds")
        print(f"📊 Questions Processed: {total_questions}")
        print(f"✅ Correct Answers: {correct_answers}")
        print(f"🎯 Factual Accuracy Score: {accuracy:.2f}%")
        print(f"⚡ Processing Rate: {total_questions/elapsed_time:.1f} questions/second")
        
        # Memory type breakdown
        memory_stats = {}
        for result in self.results:
            mem_type = result['memory_type']
            if mem_type not in memory_stats:
                memory_stats[mem_type] = {'total': 0, 'correct': 0, 'avg_confidence': 0}
            memory_stats[mem_type]['total'] += 1
            if result['correct']:
                memory_stats[mem_type]['correct'] += 1
            memory_stats[mem_type]['avg_confidence'] += result['confidence']
        
        # Calculate averages
        for stats in memory_stats.values():
            stats['accuracy'] = (stats['correct'] / stats['total']) * 100
            stats['avg_confidence'] = stats['avg_confidence'] / stats['total']
        
        print(f"\n📈 Accuracy by Memory Type:")
        for mem_type, stats in memory_stats.items():
            print(f"  {mem_type}: {stats['correct']}/{stats['total']} ({stats['accuracy']:.1f}%, conf: {stats['avg_confidence']:.2f})")
        
        return {
            'evaluation_time': elapsed_time,
            'processing_rate': total_questions/elapsed_time,
            'total_questions': total_questions,
            'correct_answers': correct_answers,
            'accuracy_percentage': accuracy,
            'memory_type_breakdown': memory_stats,
            'detailed_results': self.results
        }
    
    def save_detailed_results(self, filename: str = 'fast_evaluation_results.json'):
        """Save comprehensive results"""
        summary = {
            'evaluation_summary': {
                'total_questions': len(self.results),
                'correct_answers': sum(1 for r in self.results if r['correct']),
                'accuracy_percentage': (sum(1 for r in self.results if r['correct']) / len(self.results)) * 100,
                'avg_confidence': sum(r['confidence'] for r in self.results) / len(self.results)
            },
            'sample_results': self.results[:10],  # First 10 for quick review
            'error_analysis': [r for r in self.results if not r['correct']],
            'high_confidence_correct': [r for r in self.results if r['correct'] and r['confidence'] > 0.9],
            'detailed_results': self.results
        }
        
        with open(filename, 'w', encoding='utf-8') as f:
            json.dump(summary, f, indent=2, ensure_ascii=False)
        print(f"\n💾 Detailed results saved to {filename}")
    
    def print_sample_results(self, num_samples: int = 5):
        """Print sample results for quick review"""
        print(f"\n🔍 Sample Results (showing {num_samples} examples):")
        print("-" * 70)
        
        for i, result in enumerate(self.results[:num_samples]):
            status = "✅ CORRECT" if result['correct'] else "❌ INCORRECT"
            print(f"\n{i+1}. {result['prompt']}")
            print(f"   Expected: {result['ground_truth']}")
            print(f"   AI Response: {result['ai_response'][:80]}...")
            print(f"   {status} ({result['match_reason']}, conf: {result['confidence']:.2f})")

def main():
    # Load the updated dataset
    evaluator = FastAIEvaluator(max_workers=3)  # Conservative to avoid overwhelming server
    
    # Parse the attached file
    questions = []
    with open('attached_assets/Pasted-Prompt-Memory-Type-Ground-Truth-Answer-Who-encountered-a-bear-during-a-camping-trip-Factual-Recall--1754318779494_1754318779496.txt', 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        questions = list(reader)
    
    print(f"📝 Loaded {len(questions)} evaluation questions")
    
    # Run fast evaluation
    results = evaluator.evaluate_batch(questions)
    
    # Show sample results
    evaluator.print_sample_results(5)
    
    # Save comprehensive results
    evaluator.save_detailed_results('ai_fast_evaluation_results.json')
    
    return results

if __name__ == "__main__":
    main()