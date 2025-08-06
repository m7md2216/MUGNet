#!/usr/bin/env python3
"""
GPT-4o Complete Test - All 53 questions with robust error handling
"""

import json
import time
import openai
import os
from typing import List, Dict, Any
from datetime import datetime

# Set up OpenAI client
openai.api_key = os.getenv('OPENAI_API_KEY')

def load_conversation(filename: str) -> str:
    """Load and format conversation as text"""
    try:
        with open(filename, 'r', encoding='utf-8') as f:
            content = f.read()
        return content
    except Exception as e:
        print(f"Error loading conversation: {e}")
        return ""

def load_questions_from_file(filename: str) -> List[str]:
    """Load test questions from file"""
    try:
        with open(filename, 'r', encoding='utf-8') as f:
            content = f.read()
        
        questions = []
        lines = content.strip().split('\n')
        
        for line in lines:
            line = line.strip()
            if line and line.startswith('Q:'):
                question = line[2:].strip()
                questions.append(question)
        
        print(f"Loaded {len(questions)} questions from {filename}")
        return questions
        
    except Exception as e:
        print(f"Error loading questions from {filename}: {e}")
        return []

def test_gpt4_question(question: str, conversation: str, question_num: int, total: int) -> Dict[str, Any]:
    """Test single question with GPT-4o with retry logic"""
    start_time = time.time()
    
    max_retries = 3
    for attempt in range(max_retries):
        try:
            print(f"[{question_num}/{total}] Processing: {question[:50]}..." + (" (retry)" if attempt > 0 else ""))
            
            # Truncate if too long 
            max_chars = 100000
            if len(conversation) > max_chars:
                conversation = conversation[-max_chars:]
                truncated = True
            else:
                truncated = False
            
            system_prompt = f"""You are an AI assistant answering questions about a group conversation.

FULL CONVERSATION HISTORY:
{conversation}

Instructions:
- Answer the question based ONLY on the conversation above
- Be specific about who said what
- If you cannot find the answer in the conversation, say so clearly
- Provide direct quotes when possible"""

            response = openai.chat.completions.create(
                model="gpt-4o",
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": question}
                ],
                max_tokens=300,
                temperature=0.1
            )
            
            answer = response.choices[0].message.content
            processing_time = time.time() - start_time
            
            print(f"[{question_num}/{total}] ✓ Success in {processing_time:.2f}s")
            
            return {
                'question': question,
                'answer': answer,
                'processing_time': processing_time,
                'truncated': truncated,
                'context_size': len(conversation),
                'success': True,
                'attempts': attempt + 1
            }
            
        except Exception as e:
            if "rate limit" in str(e).lower() or "429" in str(e):
                print(f"[{question_num}/{total}] Rate limited, waiting 30s...")
                time.sleep(30)
                continue
            elif attempt < max_retries - 1:
                print(f"[{question_num}/{total}] Error (attempt {attempt + 1}): {e}")
                time.sleep(5)
                continue
            else:
                print(f"[{question_num}/{total}] ✗ Failed after {max_retries} attempts: {e}")
                return {
                    'question': question,
                    'answer': f"Error after {max_retries} attempts: {str(e)}",
                    'processing_time': time.time() - start_time,
                    'truncated': False,
                    'context_size': 0,
                    'success': False,
                    'attempts': max_retries
                }
    
    # Should not reach here
    return {
        'question': question,
        'answer': "Unexpected error",
        'processing_time': time.time() - start_time,
        'truncated': False,
        'context_size': 0,
        'success': False,
        'attempts': max_retries
    }

def main():
    """Main execution function"""
    
    # Load conversation and questions
    conversation_file = "attached_assets/Pasted-Emma-Ugh-Monday-again-I-already-miss-the-weekend-Jake-Haha-same-here-I-m-struggling-to-focu-1753900326967_1753900326968.txt"
    questions_file = "example_questions.txt"
    
    print("=== GPT-4o Complete Test Framework ===")
    print(f"Loading conversation from: {conversation_file}")
    print(f"Loading questions from: {questions_file}")
    
    conversation = load_conversation(conversation_file)
    test_questions = load_questions_from_file(questions_file)
    
    if not conversation or not test_questions:
        print("Failed to load data")
        return
    
    print(f"Conversation length: {len(conversation)} characters")
    print(f"Testing ALL {len(test_questions)} questions with GPT-4o")
    print("=" * 80)
    
    results = []
    
    for i, question in enumerate(test_questions):
        result = test_gpt4_question(question, conversation, i+1, len(test_questions))
        results.append(result)
        
        # Save intermediate results every 10 questions
        if (i + 1) % 10 == 0:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            temp_file = f"gpt4_complete_intermediate_{i+1}_{timestamp}.json"
            with open(temp_file, 'w', encoding='utf-8') as f:
                json.dump(results, f, indent=2, ensure_ascii=False)
            print(f"Saved intermediate results to: {temp_file}")
        
        # Small delay between requests
        time.sleep(1)
    
    # Save final results
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    output_file = f"gpt4_complete_results_{timestamp}.json"
    
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(results, f, indent=2, ensure_ascii=False)
    
    # Generate summary
    total_questions = len(results)
    successful = sum(1 for r in results if r['success'])
    avg_time = sum(r['processing_time'] for r in results if r['success']) / max(successful, 1)
    total_attempts = sum(r['attempts'] for r in results)
    
    print("\n" + "=" * 80)
    print("FINAL SUMMARY:")
    print(f"Total Questions: {total_questions}")
    print(f"Successful: {successful} ({successful/total_questions*100:.1f}%)")
    print(f"Failed: {total_questions - successful}")
    print(f"Average Time (successful): {avg_time:.2f}s")
    print(f"Total API Attempts: {total_attempts}")
    print(f"Final results saved to: {output_file}")
    
    # Show failed questions
    failed = [r for r in results if not r['success']]
    if failed:
        print("\nFAILED QUESTIONS:")
        for f in failed:
            print(f"- {f['question']}")
    
    return output_file

if __name__ == "__main__":
    main()