#!/usr/bin/env python3

import requests
import re
import json
import time
from typing import Dict, List, Tuple

# Configuration
BASE_URL = "http://localhost:5000"
CONVERSATION_FILE = "attached_assets/Pasted-Day-1-Emma-Ugh-Monday-again-sips-coffee-I-already-miss-the-weekend-Jake-Haha-same-here--1753727481195_1753727481195.txt"

# User name to ID mapping
USERS = {
    "Emma": 5, "Jake": 6, "Ryan": 7, "Sarah": 8, "Chloe": 9,
    "All": 10, "AI": 1, "Ali": 11, "John": 12, "Mohammad": 13, "AI Agent": 1
}

def parse_conversation_line(line: str) -> Tuple[str, str] or None:
    """Parse a conversation line and extract speaker and content."""
    line = line.strip()
    
    # Skip empty lines and narrative comments
    if not line or line.startswith('(') or line.startswith('Day ') or line.startswith('***'):
        return None
    
    # Match patterns like "Emma: message" or " Jake: message" 
    patterns = [
        r'^([A-Za-z\s]+):\s*(.+)$',  # Standard format
        r'^\s*([A-Za-z\s]+):\s*(.+)$',  # With leading spaces
        r'^@?([A-Za-z\s]+):\s*(.+)$',  # With @ prefix
    ]
    
    for pattern in patterns:
        match = re.match(pattern, line)
        if match:
            speaker = match.group(1).strip()
            content = match.group(2).strip()
            return speaker, content
    
    return None

def import_full_conversation():
    """Import the complete conversation in batches."""
    print("🚀 COMPLETE CONVERSATION IMPORTER")
    print("=" * 50)
    
    # Parse conversation file
    try:
        with open(CONVERSATION_FILE, 'r', encoding='utf-8') as f:
            lines = f.readlines()
    except FileNotFoundError:
        print(f"❌ File not found: {CONVERSATION_FILE}")
        return
    
    # Parse all messages
    messages = []
    unparsed_lines = []
    
    for i, line in enumerate(lines, 1):
        parsed = parse_conversation_line(line)
        if parsed:
            speaker, content = parsed
            if speaker in USERS:
                messages.append({
                    "speaker": speaker,
                    "content": content,
                    "userId": USERS[speaker]
                })
            else:
                print(f"⚠️  Unknown speaker '{speaker}' on line {i}: {line.strip()}")
        else:
            if line.strip() and not line.strip().startswith('Day ') and not line.strip().startswith('('):
                unparsed_lines.append(f"Line {i}: {line.strip()}")
    
    print(f"📊 Parsed {len(messages)} messages from {len(lines)} lines")
    print(f"⚠️  Skipped {len(unparsed_lines)} unparseable lines")
    
    if not messages:
        print("❌ No messages to import")
        return
    
    # Import messages in batches
    print(f"\n📨 Importing {len(messages)} messages...")
    batch_size = 10
    success_count = 0
    
    for i in range(0, len(messages), batch_size):
        batch = messages[i:i + batch_size]
        
        for msg in batch:
            try:
                # Post message
                response = requests.post(
                    f"{BASE_URL}/api/messages",
                    json={
                        "content": msg["content"],
                        "userId": msg["userId"]
                    },
                    timeout=30
                )
                
                if response.status_code == 200:
                    success_count += 1
                else:
                    print(f"❌ Failed to import message from {msg['speaker']}: {response.status_code}")
                    
            except requests.exceptions.RequestException as e:
                print(f"❌ Request failed for {msg['speaker']}: {e}")
                
            # Small delay to prevent overwhelming the server
            time.sleep(0.1)
        
        print(f"✅ Imported {min(i + batch_size, len(messages))}/{len(messages)} messages...")
    
    print(f"\n🎉 Import complete! Successfully imported {success_count}/{len(messages)} messages")
    
    # Verify final count
    try:
        response = requests.get(f"{BASE_URL}/api/messages")
        if response.status_code == 200:
            final_count = len(response.json())
            print(f"📊 Total messages in database: {final_count}")
        else:
            print("❌ Could not verify final message count")
    except Exception as e:
        print(f"❌ Error verifying count: {e}")

if __name__ == "__main__":
    import_full_conversation()