#!/usr/bin/env python3
"""
GPT-4o Only Test - Batch processing with rate limit handling
Tests GPT-4o with conversation history for evaluation questions in batches
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
        
        return questions
        
    except Exception as e:
        print(f"Error loading questions from {filename}: {e}")
        return []

def test_gpt4_question(question: str, conversation: str) -> Dict[str, Any]:
    """Test single question with GPT-4o"""
    start_time = time.time()
    
    try:
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
        
        return {
            'question': question,
            'answer': answer,
            'processing_time': processing_time,
            'truncated': truncated,
            'context_size': len(conversation),
            'success': True
        }
        
    except Exception as e:
        return {
            'question': question,
            'answer': f"Error: {str(e)}",
            'processing_time': time.time() - start_time,
            'truncated': False,
            'context_size': 0,
            'success': False
        }

def main():
    """Main execution function with batch processing"""
    
    # Load conversation and questions
    conversation_file = "attached_assets/Pasted-Emma-Ugh-Monday-again-I-already-miss-the-weekend-Jake-Haha-same-here-I-m-struggling-to-focu-1753900326967_1753900326968.txt"
    questions_file = "example_questions.txt"
    
    print("=== GPT-4o Only Test Framework (Batch) ===")
    
    conversation = load_conversation(conversation_file)
    test_questions = load_questions_from_file(questions_file)
    
    if not conversation or not test_questions:
        print("Failed to load data")
        return
    
    # Test all questions
    # test_questions = test_questions[:10]  # Remove this limit
    
    print(f"Conversation length: {len(conversation)} characters")
    print(f"Testing {len(test_questions)} questions with GPT-4o")
    print("=" * 60)
    
    results = []
    
    for i, question in enumerate(test_questions):
        print(f"\n=== Question {i+1}/{len(test_questions)} ===")
        print(f"Q: {question}")
        
        result = test_gpt4_question(question, conversation)
        results.append(result)
        
        print(f"A: {result['answer'][:100]}...")
        print(f"Time: {result['processing_time']:.2f}s")
        print(f"Success: {result['success']}")
        
        # Add shorter delay to avoid rate limits
        if i < len(test_questions) - 1:  # Don't wait after last question
            time.sleep(0.5)  # Reduced delay
    
    # Save results
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    output_file = f"gpt4_only_batch_results_{timestamp}.json"
    
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(results, f, indent=2, ensure_ascii=False)
    
    # Generate summary
    total_questions = len(results)
    successful = sum(1 for r in results if r['success'])
    avg_time = sum(r['processing_time'] for r in results) / len(results)
    
    print("\n" + "=" * 60)
    print("SUMMARY:")
    print(f"Total Questions: {total_questions}")
    print(f"Successful: {successful} ({successful/total_questions*100:.1f}%)")
    print(f"Average Time: {avg_time:.2f}s")
    print(f"Results saved to: {output_file}")
    
    return output_file

if __name__ == "__main__":
    main()