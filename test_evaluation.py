#!/usr/bin/env python3
import json
import requests
import time

# Test questions based on the imported script
test_cases = [
    {
        "question": "What did Jake say about Yosemite in the group chat?",
        "expected_keywords": ["camping", "yosemite", "waterfall", "bear", "campsite", "amazing"],
        "category": "event"
    },
    {
        "question": "How did Sarah react when Emma teased her about going bungee jumping?",
        "expected_keywords": ["fear", "lion", "wrestle", "dramatic", "refusal"],
        "category": "relationship"
    },
    {
        "question": "What music did Ryan say he dislikes?",
        "expected_keywords": ["country", "music", "not my style", "rock", "metal"],
        "category": "preference"
    }
]

def send_message(content, mentions=None):
    """Send a message to the chat system"""
    if mentions is None:
        mentions = ["AI Agent"]
    
    response = requests.post("http://localhost:5000/api/messages", 
                           json={"content": content, "mentions": mentions})
    if response.status_code == 200:
        return response.json()["message"]["id"]
    else:
        print(f"Error sending message: {response.text}")
        return None

def get_latest_messages(count=5):
    """Get the latest messages from the system"""
    response = requests.get("http://localhost:5000/api/messages")
    if response.status_code == 200:
        messages = response.json()
        return messages[-count:]
    return []

def calculate_score(actual_response, expected_keywords):
    """Calculate similarity score based on keyword presence"""
    actual_lower = actual_response.lower()
    found_keywords = sum(1 for keyword in expected_keywords if keyword.lower() in actual_lower)
    return found_keywords / len(expected_keywords)

def run_evaluation():
    """Run the evaluation tests"""
    print("🚀 Starting AI Knowledge Graph Evaluation...")
    print(f"Testing {len(test_cases)} scenarios\n")
    
    results = []
    
    for i, test in enumerate(test_cases, 1):
        print(f"📝 Test {i}: {test['category'].upper()}")
        print(f"Question: {test['question']}")
        
        # Send the question
        message_id = send_message(f"@AI {test['question']}")
        if not message_id:
            continue
            
        # Wait for AI response
        print("⏳ Waiting for AI response...")
        time.sleep(8)  # Give AI time to process and respond
        
        # Get latest messages to find AI response
        latest_messages = get_latest_messages(5)
        ai_response = None
        
        for msg in reversed(latest_messages):
            if msg.get("isAiResponse") == True:
                ai_response = msg["content"]
                break
        
        if ai_response:
            score = calculate_score(ai_response, test["expected_keywords"])
            passed = score >= 0.6
            
            print(f"🤖 AI Response: {ai_response}")
            print(f"📊 Score: {score:.1%} ({'✅ PASS' if passed else '❌ FAIL'})")
            
            results.append({
                "question": test["question"],
                "category": test["category"],
                "expected_keywords": test["expected_keywords"],
                "ai_response": ai_response,
                "score": score,
                "passed": passed
            })
        else:
            print("❌ No AI response received")
            results.append({
                "question": test["question"],
                "category": test["category"],
                "ai_response": "No response",
                "score": 0,
                "passed": False
            })
        
        print("-" * 80)
    
    # Summary
    passed_tests = sum(1 for r in results if r["passed"])
    total_tests = len(results)
    avg_score = sum(r["score"] for r in results) / total_tests if results else 0
    
    print(f"\n🎯 EVALUATION SUMMARY")
    print(f"Total Tests: {total_tests}")
    print(f"Passed: {passed_tests}")
    print(f"Failed: {total_tests - passed_tests}")
    print(f"Success Rate: {passed_tests/total_tests:.1%}")
    print(f"Average Score: {avg_score:.1%}")
    
    # Category breakdown
    categories = {}
    for result in results:
        cat = result["category"]
        if cat not in categories:
            categories[cat] = {"passed": 0, "total": 0, "scores": []}
        categories[cat]["total"] += 1
        categories[cat]["scores"].append(result["score"])
        if result["passed"]:
            categories[cat]["passed"] += 1
    
    print(f"\n📈 CATEGORY BREAKDOWN:")
    for category, stats in categories.items():
        avg_cat_score = sum(stats["scores"]) / len(stats["scores"])
        print(f"{category.upper()}: {stats['passed']}/{stats['total']} ({stats['passed']/stats['total']:.1%}) - Avg Score: {avg_cat_score:.1%}")

if __name__ == "__main__":
    run_evaluation()