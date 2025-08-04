#!/usr/bin/env python3
"""
Evaluation script for testing AI agent factual accuracy against ground truth.
Tests 50 questions from the evaluation dataset and calculates accuracy metrics.
"""

import csv
import json
import requests
import time
from typing import Dict, List, Tuple
import re

class AIAgentEvaluator:
    def __init__(self, base_url: str = "http://localhost:5000"):
        self.base_url = base_url
        self.results = []
        
    def ask_ai_agent(self, question: str) -> str:
        """Send question to AI agent and get response"""
        try:
            # Format question with AI mention
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
                timeout=30
            )
            
            if response.status_code == 200:
                data = response.json()
                ai_response = data.get("aiResponse", {}).get("content", "")
                return ai_response
            else:
                print(f"Error: HTTP {response.status_code}")
                return ""
                
        except Exception as e:
            print(f"Error asking AI: {e}")
            return ""
    
    def extract_key_info(self, response: str) -> str:
        """Extract key factual information from AI response"""
        # Remove common AI prefixes and pleasantries
        response = re.sub(r'^(Hey \w+!|Hi \w+!|According to the knowledge graph,?\s*)', '', response, flags=re.IGNORECASE)
        response = re.sub(r'\s*😊$', '', response)  # Remove emoji at end
        
        # Extract the core factual content
        # Look for patterns like "X did Y" or "The answer is X"
        response = response.strip()
        
        return response
    
    def check_factual_match(self, ground_truth: str, ai_response: str) -> Tuple[bool, str]:
        """Check if AI response matches ground truth"""
        # Normalize both strings for comparison
        truth_normalized = ground_truth.lower().strip()
        response_normalized = ai_response.lower().strip()
        
        # Check for exact substring match
        if truth_normalized in response_normalized:
            return True, "Exact match"
        
        # Check for key terms match
        truth_words = set(truth_normalized.split())
        response_words = set(response_normalized.split())
        
        # Remove common words
        common_words = {'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by'}
        truth_words -= common_words
        response_words -= common_words
        
        # Check overlap
        overlap = truth_words.intersection(response_words)
        if len(overlap) >= len(truth_words) * 0.7:  # 70% word overlap
            return True, f"Partial match ({len(overlap)}/{len(truth_words)} words)"
        
        return False, "No match"
    
    def evaluate_dataset(self, csv_file_path: str) -> Dict:
        """Evaluate all questions in the dataset"""
        print("Starting AI Agent Evaluation...")
        print("=" * 60)
        
        with open(csv_file_path, 'r', encoding='utf-8') as file:
            reader = csv.DictReader(file)
            questions = list(reader)
        
        total_questions = len(questions)
        correct_answers = 0
        
        for i, row in enumerate(questions, 1):
            prompt = row['Prompt']
            memory_type = row['Memory Type']
            ground_truth = row['Ground Truth']
            
            print(f"\n[{i}/{total_questions}] Testing: {prompt}")
            print(f"Memory Type: {memory_type}")
            print(f"Expected: {ground_truth}")
            
            # Ask AI agent
            ai_response = self.ask_ai_agent(prompt)
            
            if not ai_response:
                print("❌ No response from AI")
                match_result = False
                match_reason = "No response"
            else:
                # Check accuracy
                match_result, match_reason = self.check_factual_match(ground_truth, ai_response)
                
                if match_result:
                    correct_answers += 1
                    print(f"✅ CORRECT: {match_reason}")
                else:
                    print(f"❌ INCORRECT: {match_reason}")
                
                print(f"AI Response: {ai_response[:100]}...")
            
            # Store result
            self.results.append({
                'question_num': i,
                'prompt': prompt,
                'memory_type': memory_type,
                'ground_truth': ground_truth,
                'ai_response': ai_response,
                'correct': match_result,
                'match_reason': match_reason
            })
            
            # Small delay to avoid overwhelming the server
            time.sleep(1)
        
        # Calculate final metrics
        accuracy = (correct_answers / total_questions) * 100
        
        print("\n" + "=" * 60)
        print("EVALUATION RESULTS")
        print("=" * 60)
        print(f"Total Questions: {total_questions}")
        print(f"Correct Answers: {correct_answers}")
        print(f"Factual Accuracy Score: {accuracy:.2f}%")
        
        # Breakdown by memory type
        memory_types = {}
        for result in self.results:
            mem_type = result['memory_type']
            if mem_type not in memory_types:
                memory_types[mem_type] = {'total': 0, 'correct': 0}
            memory_types[mem_type]['total'] += 1
            if result['correct']:
                memory_types[mem_type]['correct'] += 1
        
        print("\nAccuracy by Memory Type:")
        for mem_type, stats in memory_types.items():
            type_accuracy = (stats['correct'] / stats['total']) * 100
            print(f"  {mem_type}: {stats['correct']}/{stats['total']} ({type_accuracy:.1f}%)")
        
        return {
            'total_questions': total_questions,
            'correct_answers': correct_answers,
            'accuracy_percentage': accuracy,
            'memory_type_breakdown': memory_types,
            'detailed_results': self.results
        }
    
    def save_results(self, filename: str = 'evaluation_results.json'):
        """Save detailed results to JSON file"""
        with open(filename, 'w', encoding='utf-8') as f:
            json.dump({
                'evaluation_summary': {
                    'total_questions': len(self.results),
                    'correct_answers': sum(1 for r in self.results if r['correct']),
                    'accuracy_percentage': (sum(1 for r in self.results if r['correct']) / len(self.results)) * 100
                },
                'detailed_results': self.results
            }, f, indent=2, ensure_ascii=False)
        print(f"\nDetailed results saved to {filename}")

def main():
    evaluator = AIAgentEvaluator()
    
    # Run evaluation
    results = evaluator.evaluate_dataset('attached_assets/Compiled_Memory_Prompts_50_1754317401914.csv')
    
    # Save results
    evaluator.save_results('ai_agent_evaluation_results.json')

if __name__ == "__main__":
    main()