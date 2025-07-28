import OpenAI from "openai";
import { knowledgeGraphService } from "./knowledgeGraph";
import { storage } from "../storage";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

interface TestCase {
  question: string;
  expectedAnswer: string;
  category: 'event' | 'relationship' | 'preference' | 'entity' | 'humor';
  actualAnswer?: string;
  passed?: boolean;
  score?: number;
}

export class ManualEvaluator {
  private testCases: TestCase[] = [
    {
      question: "What did Jake say about Yosemite in the group chat?",
      expectedAnswer: "Jake mentioned that he went camping in Yosemite and had an amazing time. He described breathtaking waterfall hikes and even told us about a scary moment when a bear wandered near his campsite. He said it was incredible overall, but that the bear encounter gave him a real fright.",
      category: 'event'
    },
    {
      question: "How did Sarah react when Emma teased her about going bungee jumping?",
      expectedAnswer: "When Emma suggested bungee jumping, Sarah reacted with emphatic fear and humor. She basically said she'd rather wrestle a lion than go bungee jumping! It was a pretty dramatic refusal, and everyone laughed.",
      category: 'relationship'
    },
    {
      question: "What music did Ryan say he dislike in our past conversations?",
      expectedAnswer: "You mentioned that you can't stand country music. In our music discussion, you said it's not your style and you'd take rock or metal over country any day.",
      category: 'preference'
    }
  ];

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

  private calculateSimilarityScore(actual: string, expected: string): number {
    const actualLower = actual.toLowerCase();
    const expectedLower = expected.toLowerCase();
    
    // Extract key terms from expected answer (3+ character words)
    const keyTerms = expectedLower.match(/\b\w{3,}\b/g) || [];
    
    // Count how many key terms appear in actual answer
    const foundTerms = keyTerms.filter(term => actualLower.includes(term));
    
    // Calculate percentage match
    return foundTerms.length / keyTerms.length;
  }

  async runEvaluation(): Promise<{
    tests: TestCase[];
    summary: {
      total: number;
      passed: number;
      failed: number;
      averageScore: number;
      categories: Record<string, { passed: number; total: number; avgScore: number }>;
    };
  }> {
    console.log('Starting manual AI evaluation...');
    
    // Run each test case
    for (const testCase of this.testCases) {
      console.log(`\n🔍 Testing: ${testCase.question}`);
      
      testCase.actualAnswer = await this.getAIResponse(testCase.question);
      testCase.score = this.calculateSimilarityScore(testCase.actualAnswer, testCase.expectedAnswer);
      testCase.passed = testCase.score >= 0.6; // 60% similarity threshold
      
      console.log(`Expected: ${testCase.expectedAnswer}`);
      console.log(`Actual: ${testCase.actualAnswer}`);
      console.log(`Score: ${(testCase.score * 100).toFixed(1)}% - ${testCase.passed ? '✅ PASS' : '❌ FAIL'}`);
    }
    
    // Calculate summary statistics
    const passed = this.testCases.filter(t => t.passed).length;
    const failed = this.testCases.length - passed;
    const averageScore = this.testCases.reduce((sum, t) => sum + (t.score || 0), 0) / this.testCases.length;
    
    const categories: Record<string, { passed: number; total: number; avgScore: number }> = {};
    for (const test of this.testCases) {
      if (!categories[test.category]) {
        categories[test.category] = { passed: 0, total: 0, avgScore: 0 };
      }
      categories[test.category].total++;
      categories[test.category].avgScore += test.score || 0;
      if (test.passed) {
        categories[test.category].passed++;
      }
    }
    
    // Calculate average scores for categories
    Object.values(categories).forEach(cat => {
      cat.avgScore = cat.avgScore / cat.total;
    });
    
    return {
      tests: this.testCases,
      summary: {
        total: this.testCases.length,
        passed,
        failed,
        averageScore,
        categories
      }
    };
  }
}

export const manualEvaluator = new ManualEvaluator();