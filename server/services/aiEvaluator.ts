import OpenAI from "openai";
import { knowledgeGraphService } from "./knowledgeGraph";
import { storage } from "../storage";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

interface EvaluationTest {
  question: string;
  expectedAnswer: string;
  actualAnswer?: string;
  passed?: boolean;
  category: 'event' | 'relationship' | 'preference' | 'entity' | 'humor';
}

export class AIEvaluator {
  private extractTestQuestions(messages: any[]): EvaluationTest[] {
    const tests: EvaluationTest[] = [];
    
    // Look for AI test messages (contain @AI)
    for (let i = 0; i < messages.length; i++) {
      const message = messages[i];
      
      // Find questions asked to AI (case insensitive)
      if (message.content.toLowerCase().includes('@ai') && message.content.includes('?')) {
        const nextMessage = messages[i + 1];
        if (nextMessage && nextMessage.content.startsWith('AI:')) {
          const question = message.content.replace(/@ai/gi, '').replace(/[@,]/g, '').trim();
          const expectedAnswer = nextMessage.content.replace('AI:', '').trim();
          
          // Categorize the test
          let category: EvaluationTest['category'] = 'event';
          const lowerQuestion = question.toLowerCase();
          if (lowerQuestion.includes('react') || lowerQuestion.includes('feeling')) {
            category = 'relationship';
          } else if (lowerQuestion.includes('music') || lowerQuestion.includes('dislike')) {
            category = 'preference';
          } else if (lowerQuestion.includes('city') || lowerQuestion.includes('travel')) {
            category = 'entity';
          } else if (lowerQuestion.includes('joke') || lowerQuestion.includes('singing')) {
            category = 'humor';
          }
          
          tests.push({
            question,
            expectedAnswer,
            category
          });
          
          console.log(`Found test: ${question} -> ${expectedAnswer}`);
        }
      }
    }
    
    return tests;
  }

  private async getAIResponse(question: string): Promise<string> {
    try {
      // Get intelligent context from knowledge graph
      const context = await knowledgeGraphService.getIntelligentContext(question, 50);
      
      // Get recent conversation history for additional context
      const recentMessages = await storage.getAllMessages();
      const userMap = new Map();
      
      // Build user lookup map
      const allUsers = await storage.getAllUsers();
      for (const user of allUsers) {
        userMap.set(user.id, user.name);
      }
      
      // Format conversation history
      const conversationHistory = recentMessages.slice(-50).map((msg: any) => {
        const userName = userMap.get(msg.userId) || 'Unknown';
        return `${userName}: ${msg.content}`;
      }).join('\n');
      
      const prompt = `You are an AI assistant in a group chat. Based on the conversation history and knowledge graph data, answer this question accurately and naturally.

KNOWLEDGE GRAPH CONTEXT:
${JSON.stringify(context, null, 2)}

RECENT CONVERSATION HISTORY:
${conversationHistory}

QUESTION: ${question}

Provide a natural, conversational response that accurately reflects the information from the conversations. Be specific and reference the actual details mentioned.`;

      const response = await openai.chat.completions.create({
        model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
        messages: [{ role: "user", content: prompt }],
        max_tokens: 300,
        temperature: 0.3, // Lower temperature for more consistent, factual responses
      });

      return response.choices[0].message.content?.trim() || '';
    } catch (error) {
      console.error('Error getting AI response:', error);
      return 'I apologize, but I encountered an error while processing your question.';
    }
  }

  private compareAnswers(actual: string, expected: string): boolean {
    // Simple similarity check - look for key concepts
    const actualLower = actual.toLowerCase();
    const expectedLower = expected.toLowerCase();
    
    // Extract key terms from expected answer
    const keyTerms = expectedLower.match(/\b\w{3,}\b/g) || [];
    
    // Check if at least 60% of key terms are present in actual answer
    const foundTerms = keyTerms.filter(term => actualLower.includes(term));
    const similarity = foundTerms.length / keyTerms.length;
    
    return similarity >= 0.6;
  }

  async runEvaluation(): Promise<{
    tests: EvaluationTest[];
    summary: {
      total: number;
      passed: number;
      failed: number;
      categories: Record<string, { passed: number; total: number }>;
    };
  }> {
    // Get all messages to extract test questions
    const allMessages = await storage.getAllMessages();
    const tests = this.extractTestQuestions(allMessages);
    
    console.log(`Found ${tests.length} evaluation tests`);
    
    // Run each test
    for (const test of tests) {
      console.log(`Running test: ${test.question}`);
      test.actualAnswer = await this.getAIResponse(test.question);
      test.passed = this.compareAnswers(test.actualAnswer, test.expectedAnswer);
      
      console.log(`Expected: ${test.expectedAnswer}`);
      console.log(`Actual: ${test.actualAnswer}`);
      console.log(`Result: ${test.passed ? 'PASS' : 'FAIL'}\n`);
    }
    
    // Calculate summary statistics
    const passed = tests.filter(t => t.passed).length;
    const failed = tests.length - passed;
    
    const categories: Record<string, { passed: number; total: number }> = {};
    for (const test of tests) {
      if (!categories[test.category]) {
        categories[test.category] = { passed: 0, total: 0 };
      }
      categories[test.category].total++;
      if (test.passed) {
        categories[test.category].passed++;
      }
    }
    
    return {
      tests,
      summary: {
        total: tests.length,
        passed,
        failed,
        categories
      }
    };
  }
}

export const aiEvaluator = new AIEvaluator();