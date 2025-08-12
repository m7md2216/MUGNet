#!/usr/bin/env python3
"""
Conversation Importer - Automatically imports conversation scripts into the chat system
Usage: Place your conversation script in a text file and run this script
"""

import requests
import json
import time
import re
from datetime import datetime
from typing import List, Dict, Optional


class ConversationImporter:

    def __init__(self, base_url: str = "http://localhost:5000"):
        self.base_url = base_url
        self.users = {}
        self.imported_messages = []

    def load_users(self) -> Dict[str, int]:
        """Load existing users from the system"""
        try:
            response = requests.get(f"{self.base_url}/api/users")
            if response.status_code == 200:
                users_list = response.json()
                return {user['name']: user['id'] for user in users_list}
            else:
                print(f"❌ Failed to load users: {response.status_code}")
                return {}
        except Exception as e:
            print(f"❌ Error loading users: {e}")
            return {}

    def create_user(self, name: str) -> Optional[int]:
        """Create a new user if they don't exist"""
        try:
            # Generate initials and color
            initials = ''.join(
                [word[0].upper() for word in name.split() if word])[:2]
            colors = ['blue', 'green', 'purple', 'orange', 'pink', 'yellow']
            color = colors[hash(name) % len(colors)]

            user_data = {'name': name, 'initials': initials, 'color': color}

            response = requests.post(f"{self.base_url}/api/users",
                                     json=user_data)
            if response.status_code == 201:
                user = response.json()
                print(f"✅ Created user: {name} (ID: {user['id']})")
                return user['id']
            else:
                print(
                    f"❌ Failed to create user {name}: {response.status_code}")
                return None
        except Exception as e:
            print(f"❌ Error creating user {name}: {e}")
            return None

    def parse_conversation_script(self, file_path: str) -> List[Dict]:
        """Parse conversation script from file"""
        messages = []

        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()
        except FileNotFoundError:
            print(f"❌ File not found: {file_path}")
            return []
        except Exception as e:
            print(f"❌ Error reading file: {e}")
            return []

        print(f"📖 Parsing conversation script from: {file_path}")

        # Multiple parsing patterns for different conversation formats
        patterns = [
            # Pattern 1: "Name: Message"
            r'^([A-Za-z]+):\s*(.+)$',
            # Pattern 2: "Day X - Name: Message"
            r'^Day\s+\d+\s*-\s*([A-Za-z]+):\s*(.+)$',
            # Pattern 3: "[Name] Message"
            r'^\[([A-Za-z]+)\]\s*(.+)$',
            # Pattern 4: "Name - Message"
            r'^([A-Za-z]+)\s*-\s*(.+)$'
        ]

        lines = content.strip().split('\n')
        parsed_count = 0

        for line_num, line in enumerate(lines, 1):
            line = line.strip()
            if not line or line.startswith('#') or line.startswith('//'):
                continue

            parsed = False
            for pattern in patterns:
                match = re.match(pattern, line, re.MULTILINE)
                if match:
                    name = match.group(1).strip()
                    message = match.group(2).strip()

                    if name and message:
                        messages.append({
                            'speaker': name,
                            'content': message,
                            'line_number': line_num
                        })
                        parsed_count += 1
                        parsed = True
                        break

            if not parsed and line:
                print(
                    f"⚠️  Line {line_num} couldn't be parsed: {line[:50]}...")

        print(f"📊 Parsed {parsed_count} messages from {len(lines)} lines")
        return messages

    def import_conversation(self,
                            file_path: str,
                            delay_between_messages: float = 0.1) -> bool:
        """Import entire conversation script into the chat system"""

        print("🚀 CONVERSATION IMPORTER")
        print("=" * 50)

        # Load existing users
        self.users = self.load_users()
        print(
            f"📋 Loaded {len(self.users)} existing users: {list(self.users.keys())}"
        )

        # Parse conversation
        messages = self.parse_conversation_script(file_path)
        if not messages:
            print("❌ No messages to import")
            return False

        # Create missing users
        unique_speakers = set(msg['speaker'] for msg in messages)
        print(f"👥 Found speakers: {', '.join(unique_speakers)}")

        for speaker in unique_speakers:
            if speaker not in self.users:
                user_id = self.create_user(speaker)
                if user_id:
                    self.users[speaker] = user_id

        # Import messages
        print(f"\n📨 Importing {len(messages)} messages...")
        successful_imports = 0

        for i, message in enumerate(messages, 1):
            speaker = message['speaker']
            content = message['content']

            if speaker not in self.users:
                print(f"❌ User {speaker} not found, skipping message {i}")
                continue

            try:
                # Send message to chat system
                message_data = {
                    'userId': self.users[speaker],
                    'content': content
                }

                response = requests.post(f"{self.base_url}/api/messages",
                                         json=message_data)

                if response.status_code in [200, 201]:
                    successful_imports += 1
                    self.imported_messages.append({
                        'speaker':
                        speaker,
                        'content':
                        content,
                        'message_id':
                        response.json().get('id'),
                        'import_order':
                        i
                    })

                    if i % 10 == 0 or i == len(messages):
                        print(f"✅ Imported {i}/{len(messages)} messages...")
                else:
                    print(
                        f"❌ Failed to import message {i} from {speaker}: {response.status_code}"
                    )

                # Small delay to avoid overwhelming the server
                if delay_between_messages > 0:
                    time.sleep(delay_between_messages)

            except Exception as e:
                print(f"❌ Error importing message {i}: {e}")

        print(f"\n🎯 IMPORT COMPLETE")
        print(
            f"✅ Successfully imported: {successful_imports}/{len(messages)} messages"
        )
        print(f"👥 Users involved: {len(self.users)}")
        print(
            f"📊 Import success rate: {(successful_imports/len(messages))*100:.1f}%"
        )

        # Save import log
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        log_data = {
            'import_timestamp':
            datetime.now().isoformat(),
            'source_file':
            file_path,
            'total_messages':
            len(messages),
            'successful_imports':
            successful_imports,
            'users_created':
            [user for user in unique_speakers if user in self.users],
            'imported_messages':
            self.imported_messages
        }

        log_filename = f"conversation_import_log_{timestamp}.json"
        with open(log_filename, 'w') as f:
            json.dump(log_data, f, indent=2)

        print(f"📋 Import log saved: {log_filename}")

        return successful_imports > 0


def main():
    """Main function - modify the file path to your conversation script"""

    # 🔧 CONFIGURATION - Change this to your conversation script file
    conversation_file = "conversation_script.txt"  # Change this path!

    print("📖 CONVERSATION IMPORTER TOOL")
    print("=" * 60)
    print("🔧 To use this tool:")
    print("1. Place your conversation script in a text file")
    print(
        "2. Update the 'conversation_file' variable above with your file path")
    print("3. Run this script")
    print("")
    print("📝 Supported formats:")
    print("   Emma: I'm so excited for the weekend!")
    print("   Jake: Same here, any plans?")
    print("   Day 1 - Sarah: Hey everyone!")
    print("   [Ryan] Looking forward to the picnic")
    print("=" * 60)

    importer = ConversationImporter()

    # Check if conversation file exists
    import os
    if not os.path.exists(conversation_file):
        print(f"❌ Conversation file not found: {conversation_file}")
        print(
            "📝 Please create a conversation script file with the format above")
        print("💡 Example file content:")
        print("Emma: Ugh, Monday again. I already miss the weekend.")
        print("Jake: Haha, same here. I'm struggling to focus on work.")
        print("Sarah: Tell me about it. I need more coffee.")
        return

    # Import the conversation
    success = importer.import_conversation(conversation_file)

    if success:
        print("\n🎉 Ready for evaluation!")
        print(
            "💡 You can now run the question evaluator to test the AI's knowledge"
        )
    else:
        print("\n❌ Import failed - please check the file format and try again")


if __name__ == "__main__":
    main()
