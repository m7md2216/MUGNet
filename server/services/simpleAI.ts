import OpenAI from 'openai';
import { storage } from '../storage';
import { neo4jService } from './neo4j';

interface AIContext {
  currentMessage: string;
  senderName: string;
  conversationHistory: Array<{
    id: number;
    content: string;
    senderName: string;
    timestamp: string;
  }>;
  relevantEntities: string[];
}

export class SimpleAIService {
  private openai: OpenAI;

  constructor() {
    this.openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }

  async generateResponse(context: AIContext): Promise<string> {
    try {
      // Get recent conversation history (last 20 messages)
      const recentHistory = context.conversationHistory.slice(-20);
      
      // Format conversation for AI
      const conversationText = recentHistory
        .map(msg => `${msg.senderName}: ${msg.content}`)
        .join('\n');

      // Get relevant entities from Neo4j for context
      const entityContext = await this.getEntityContext(context.currentMessage);

      const systemPrompt = `You are an AI assistant in a group chat. You have access to conversation history and knowledge about discussed topics.

Current conversation context:
${conversationText}

Related topics from past conversations:
${entityContext}

Instructions:
- Be conversational and friendly
- Reference past discussions when relevant
- Answer questions based on the conversation history
- If asked about specific people or topics, use the context provided
- Keep responses concise but helpful`;

      const response = await this.openai.chat.completions.create({
        model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `${context.senderName}: ${context.currentMessage}` }
        ],
        max_tokens: 300,
        temperature: 0.7
      });

      return response.choices[0].message.content || "I'm having trouble responding right now.";
    } catch (error) {
      console.error('AI response failed:', error);
      return "I'm having trouble responding right now. Please try again.";
    }
  }

  private async getEntityContext(message: string): Promise<string> {
    try {
      // Extract key terms from the current message
      const words = message.toLowerCase().split(/\s+/);
      const relevantEntities: string[] = [];

      // Look for entities in Neo4j that match message content
      for (const word of words) {
        if (word.length > 3) {
          const relatedMessages = await neo4jService.findMessagesByTopic(word, Math.floor(3));
          if (relatedMessages.length > 0) {
            relevantEntities.push(`${word}: mentioned in ${relatedMessages.length} previous messages`);
          }
        }
      }

      return relevantEntities.length > 0 
        ? relevantEntities.join('\n')
        : 'No specific context from previous conversations';
    } catch (error) {
      console.warn('Failed to get entity context:', error);
      return 'Context unavailable';
    }
  }

  async findRelevantHistory(query: string, limit: number = 5): Promise<any[]> {
    try {
      // Simple keyword-based search through Neo4j
      const results = await neo4jService.findMessagesByTopic(query, limit);
      return results;
    } catch (error) {
      console.warn('Failed to find relevant history:', error);
      return [];
    }
  }
}

export const simpleAIService = new SimpleAIService();