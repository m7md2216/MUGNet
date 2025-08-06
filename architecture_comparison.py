#!/usr/bin/env python3
"""
AI Architecture Comparison Framework
Compares different approaches for answering questions from conversational data:
1. Pure LLM with full conversation history
2. LLM + RAG (Retrieval Augmented Generation)
3. LLM + Knowledge Graph (current system)
"""

import json
import time
import openai
import os
from typing import List, Dict, Any
from datetime import datetime

# Set up OpenAI client
openai.api_key = os.getenv('OPENAI_API_KEY')

class ConversationData:
    """Handles loading and managing conversation data"""
    
    def __init__(self, conversation_file: str):
        self.conversation_file = conversation_file
        self.messages = self.load_conversation()
    
    def load_conversation(self) -> List[Dict[str, str]]:
        """Load conversation from file"""
        try:
            # Read the conversation file
            with open(self.conversation_file, 'r', encoding='utf-8') as f:
                content = f.read()
            
            # Parse conversation into structured format
            messages = []
            lines = content.strip().split('\n')
            
            for line in lines:
                line = line.strip()
                if ':' in line and not line.startswith('#'):
                    # Split on first colon to handle names with colons
                    parts = line.split(':', 1)
                    if len(parts) == 2:
                        speaker = parts[0].strip()
                        content = parts[1].strip()
                        messages.append({
                            'speaker': speaker,
                            'content': content,
                            'timestamp': datetime.now().isoformat()
                        })
            
            print(f"Loaded {len(messages)} messages from conversation")
            return messages
        
        except Exception as e:
            print(f"Error loading conversation: {e}")
            return []
    
    def get_full_conversation_text(self) -> str:
        """Get full conversation as text"""
        return '\n'.join([f"{msg['speaker']}: {msg['content']}" for msg in self.messages])
    
    def get_recent_messages(self, limit: int = 50) -> List[Dict[str, str]]:
        """Get recent messages for context"""
        return self.messages[-limit:]

class Architecture1_PureLLM:
    """Architecture 1: Pure LLM with full conversation history in context window"""
    
    def __init__(self):
        self.name = "Pure LLM with Full Context"
        self.description = "Uses GPT-4o with entire conversation history in context window"
    
    def answer_question(self, question: str, conversation_data: ConversationData) -> Dict[str, Any]:
        """Answer question using full conversation context"""
        start_time = time.time()
        
        try:
            full_conversation = conversation_data.get_full_conversation_text()
            
            # Truncate if too long (GPT-4o has ~128k token limit)
            max_chars = 100000  # Conservative estimate
            if len(full_conversation) > max_chars:
                full_conversation = full_conversation[-max_chars:]
                truncated = True
            else:
                truncated = False
            
            system_prompt = f"""You are an AI assistant answering questions about a group conversation.

FULL CONVERSATION HISTORY:
{full_conversation}

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
                'architecture': self.name,
                'question': question,
                'answer': answer,
                'processing_time': processing_time,
                'truncated': truncated,
                'context_size': len(full_conversation),
                'success': True
            }
            
        except Exception as e:
            return {
                'architecture': self.name,
                'question': question,
                'answer': f"Error: {str(e)}",
                'processing_time': time.time() - start_time,
                'truncated': False,
                'context_size': 0,
                'success': False
            }

class Architecture2_LLM_RAG:
    """Architecture 2: LLM + RAG (Retrieval Augmented Generation)"""
    
    def __init__(self):
        self.name = "LLM + RAG"
        self.description = "Uses semantic search to retrieve relevant conversation chunks, then LLM to answer"
        self.conversation_chunks = []
    
    def index_conversation(self, conversation_data: ConversationData):
        """Create chunks of conversation for retrieval"""
        messages = conversation_data.messages
        
        # Create overlapping chunks of 10 messages each
        chunk_size = 10
        overlap = 3
        
        self.conversation_chunks = []
        for i in range(0, len(messages), chunk_size - overlap):
            chunk_messages = messages[i:i + chunk_size]
            chunk_text = '\n'.join([f"{msg['speaker']}: {msg['content']}" for msg in chunk_messages])
            
            self.conversation_chunks.append({
                'id': i,
                'text': chunk_text,
                'messages': chunk_messages,
                'start_index': i,
                'end_index': min(i + chunk_size, len(messages))
            })
        
        print(f"Created {len(self.conversation_chunks)} conversation chunks")
    
    def retrieve_relevant_chunks(self, question: str, top_k: int = 5) -> List[Dict[str, Any]]:
        """Retrieve most relevant conversation chunks using keyword matching"""
        # Simple keyword-based retrieval (in production, would use embeddings)
        question_words = set(question.lower().split())
        
        scored_chunks = []
        for chunk in self.conversation_chunks:
            chunk_words = set(chunk['text'].lower().split())
            score = len(question_words.intersection(chunk_words))
            scored_chunks.append((score, chunk))
        
        # Sort by score and return top k
        scored_chunks.sort(key=lambda x: x[0], reverse=True)
        return [chunk for score, chunk in scored_chunks[:top_k]]
    
    def answer_question(self, question: str, conversation_data: ConversationData) -> Dict[str, Any]:
        """Answer question using RAG approach"""
        start_time = time.time()
        
        try:
            # Index conversation if not already done
            if not self.conversation_chunks:
                self.index_conversation(conversation_data)
            
            # Retrieve relevant chunks
            relevant_chunks = self.retrieve_relevant_chunks(question, top_k=5)
            
            # Combine relevant chunks
            retrieved_context = '\n\n--- CHUNK ---\n'.join([chunk['text'] for chunk in relevant_chunks])
            
            system_prompt = f"""You are an AI assistant answering questions about a group conversation.

RELEVANT CONVERSATION EXCERPTS:
{retrieved_context}

Instructions:
- Answer the question based ONLY on the conversation excerpts above
- Be specific about who said what
- If you cannot find the answer in the provided excerpts, say so clearly
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
                'architecture': self.name,
                'question': question,
                'answer': answer,
                'processing_time': processing_time,
                'chunks_retrieved': len(relevant_chunks),
                'context_size': len(retrieved_context),
                'relevant_chunks': [chunk['id'] for chunk in relevant_chunks],
                'success': True
            }
            
        except Exception as e:
            return {
                'architecture': self.name,
                'question': question,
                'answer': f"Error: {str(e)}",
                'processing_time': time.time() - start_time,
                'chunks_retrieved': 0,
                'context_size': 0,
                'success': False
            }

class Architecture3_LLM_KnowledgeGraph:
    """Architecture 3: LLM + Knowledge Graph (current system)"""
    
    def __init__(self):
        self.name = "LLM + Knowledge Graph"
        self.description = "Uses Neo4j knowledge graph + GPT-4o (current system)"
    
    def answer_question(self, question: str, conversation_data: ConversationData) -> Dict[str, Any]:
        """Answer question by calling the current system API"""
        start_time = time.time()
        
        try:
            import requests
            
            # Call the current system API
            response = requests.post('http://localhost:5000/api/messages', 
                json={
                    'content': f'@AI Agent {question}',
                    'userId': 5
                },
                headers={'Content-Type': 'application/json'}
            )
            
            if response.status_code == 200:
                data = response.json()
                answer = data.get('aiResponse', {}).get('content', 'No response')
                processing_time = time.time() - start_time
                
                return {
                    'architecture': self.name,
                    'question': question,
                    'answer': answer,
                    'processing_time': processing_time,
                    'used_knowledge_graph': True,
                    'success': True
                }
            else:
                return {
                    'architecture': self.name,
                    'question': question,
                    'answer': f"API Error: {response.status_code}",
                    'processing_time': time.time() - start_time,
                    'used_knowledge_graph': False,
                    'success': False
                }
                
        except Exception as e:
            return {
                'architecture': self.name,
                'question': question,
                'answer': f"Error: {str(e)}",
                'processing_time': time.time() - start_time,
                'used_knowledge_graph': False,
                'success': False
            }

class ArchitectureComparison:
    """Main comparison framework"""
    
    def __init__(self, conversation_file: str):
        self.conversation_data = ConversationData(conversation_file)
        self.architectures = [
            Architecture1_PureLLM(),
            Architecture2_LLM_RAG(),
            Architecture3_LLM_KnowledgeGraph()
        ]
        self.results = []
    
    def run_comparison(self, test_questions: List[str]) -> List[Dict[str, Any]]:
        """Run comparison across all architectures and questions"""
        print(f"Running comparison with {len(test_questions)} questions across {len(self.architectures)} architectures")
        
        all_results = []
        
        for i, question in enumerate(test_questions):
            print(f"\n=== Question {i+1}/{len(test_questions)}: {question} ===")
            
            question_results = []
            
            for architecture in self.architectures:
                print(f"Testing {architecture.name}...")
                result = architecture.answer_question(question, self.conversation_data)
                result['question_id'] = i
                question_results.append(result)
                all_results.append(result)
                
                print(f"  Answer: {result['answer'][:100]}...")
                print(f"  Time: {result['processing_time']:.2f}s")
            
            self.results.append({
                'question': question,
                'question_id': i,
                'results': question_results
            })
        
        return all_results
    
    def save_results(self, filename: str):
        """Save results to JSON file"""
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        output_file = f"{filename}_{timestamp}.json"
        
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(self.results, f, indent=2, ensure_ascii=False)
        
        print(f"Results saved to {output_file}")
        return output_file
    
    def generate_summary_report(self) -> str:
        """Generate a summary comparison report"""
        if not self.results:
            return "No results to summarize"
        
        report = "# AI Architecture Comparison Report\n\n"
        report += f"**Generated:** {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n"
        report += f"**Questions Tested:** {len(self.results)}\n"
        report += f"**Architectures Compared:** {len(self.architectures)}\n\n"
        
        # Architecture descriptions
        report += "## Architectures\n\n"
        for arch in self.architectures:
            report += f"**{arch.name}:** {arch.description}\n\n"
        
        # Question-by-question comparison
        report += "## Results by Question\n\n"
        
        for result in self.results:
            report += f"### Q: {result['question']}\n\n"
            
            for arch_result in result['results']:
                report += f"**{arch_result['architecture']}:**\n"
                report += f"- Answer: {arch_result['answer']}\n"
                report += f"- Time: {arch_result['processing_time']:.2f}s\n"
                if 'context_size' in arch_result:
                    report += f"- Context Size: {arch_result['context_size']} chars\n"
                report += "\n"
        
        # Performance summary
        report += "## Performance Summary\n\n"
        
        for arch in self.architectures:
            arch_results = [r for result in self.results for r in result['results'] if r['architecture'] == arch.name]
            if arch_results:
                avg_time = sum(r['processing_time'] for r in arch_results) / len(arch_results)
                success_rate = sum(1 for r in arch_results if r['success']) / len(arch_results) * 100
                
                report += f"**{arch.name}:**\n"
                report += f"- Average Response Time: {avg_time:.2f}s\n"
                report += f"- Success Rate: {success_rate:.1f}%\n\n"
        
        return report

def load_questions_from_file(filename: str) -> List[str]:
    """Load test questions from file"""
    try:
        with open(filename, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # Extract questions (lines that end with ?)
        questions = []
        lines = content.strip().split('\n')
        
        for line in lines:
            line = line.strip()
            if line and line.endswith('?') and not line.startswith('#'):
                questions.append(line)
        
        print(f"Loaded {len(questions)} questions from {filename}")
        return questions
        
    except Exception as e:
        print(f"Error loading questions from {filename}: {e}")
        # Fallback to default questions
        return [
            "Who said they would pop a red telephone booth in their carry-on?",
            "Which song did Emma have on repeat?",
            "Who encountered a bear during a camping trip?"
        ]

def main():
    """Main execution function"""
    
    # Load test questions from file
    test_questions = load_questions_from_file("conversation_script.txt")
    
    # Load conversation data
    conversation_file = "attached_assets/Pasted-Emma-Ugh-Monday-again-I-already-miss-the-weekend-Jake-Haha-same-here-I-m-struggling-to-focu-1753900326967_1753900326968.txt"
    
    print("=== AI Architecture Comparison Framework ===")
    print(f"Loading conversation from: {conversation_file}")
    
    # Run comparison
    comparison = ArchitectureComparison(conversation_file)
    results = comparison.run_comparison(test_questions)
    
    # Save results
    output_file = comparison.save_results("architecture_comparison_results")
    
    # Generate and save report
    report = comparison.generate_summary_report()
    report_file = f"architecture_comparison_report_{datetime.now().strftime('%Y%m%d_%H%M%S')}.md"
    
    with open(report_file, 'w', encoding='utf-8') as f:
        f.write(report)
    
    print(f"Report saved to {report_file}")
    print("\n=== Comparison Complete ===")
    
    return output_file, report_file

if __name__ == "__main__":
    main()