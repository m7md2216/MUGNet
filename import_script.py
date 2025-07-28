#!/usr/bin/env python3
import requests
import json

def import_script():
    # Read the script file
    with open('script.txt', 'r') as f:
        script_content = f.read()
    
    # Import the script
    response = requests.post(
        "http://localhost:5000/api/import-script",
        json={"scriptContent": script_content}
    )
    
    if response.status_code == 200:
        result = response.json()
        print(f"✅ Script imported successfully!")
        print(f"Conversation messages: {result['conversationMessages']}")
        print(f"Test messages: {result['testMessages']}")
        print(f"Total messages: {result['totalMessages']}")
        print(f"Users created: {result['users']}")
        return True
    else:
        print(f"❌ Failed to import script: {response.text}")
        return False

if __name__ == "__main__":
    import_script()