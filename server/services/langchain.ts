import OpenAI from 'openai';
import { User, Message } from '@shared/schema';
import { neo4jService } from './neo4j';

interface MemoryEntry {
  input: string;
  output: string;
  timestamp: Date;
  sender: string;
  recipients: string[];
  topics: string[];
}

interface ReasoningContext {
  query: string;
  sender: User;
  conversationHistory: Message[];
  relevantMessages: any[];
  topics: string[];
  timeframe?: string;
}

export class LangChainService {
  private openai: OpenAI;
  private userMemories: Map<string, MemoryEntry[]> = new Map();
  private promptTemplate: string;

  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    this.promptTemplate = `You are an AI assistant in a multi-user chat system. You have access to conversation history and can recall past interactions.

Current time: {currentTime}
Query from {sender}: {query}

Recent conversation history:
{conversationHistory}

Relevant past messages based on your query:
{relevantMessages}

Topics mentioned: {topics}

Instructions:
1. Provide a helpful, contextual response based on the conversation history
2. Reference specific past messages when relevant
3. Be natural and conversational
4. If asked about specific users, topics, or timeframes, use the provided context
5. If you can't find relevant information, acknowledge this honestly

Response:`;
  }

  async getOrCreateMemory(userId: string): Promise<MemoryEntry[]> {
    if (!this.userMemories.has(userId)) {
      this.userMemories.set(userId, []);
    }
    return this.userMemories.get(userId)!;
  }

  async addToMemory(userId: string, entry: MemoryEntry): Promise<void> {
    const memory = await this.getOrCreateMemory(userId);
    memory.push(entry);
    
    // Keep only the last 50 entries per user
    if (memory.length > 50) {
      memory.splice(0, memory.length - 50);
    }
    
    this.userMemories.set(userId, memory);
  }

  async generateContextualResponse(context: ReasoningContext): Promise<string> {
    try {
      // Get relevant messages from Neo4j based on query analysis
      const relevantMessages = await this.findRelevantMessages(context);
      
      // Format conversation history
      const conversationHistory = context.conversationHistory
        .slice(-10) // Last 10 messages for context
        .map(msg => `${this.getUserName(msg.userId, context.sender)}: ${msg.content}`)
        .join('\n');

      // Format relevant messages
      const relevantMessagesText = relevantMessages.length > 0
        ? relevantMessages.map(msg => 
            `${msg.sender} (${new Date(msg.timestamp).toLocaleDateString()}): ${msg.content}`
          ).join('\n')
        : 'No specific relevant messages found.';

      // Generate response using the prompt template
      const prompt = this.promptTemplate
        .replace('{query}', context.query)
        .replace('{sender}', context.sender.name)
        .replace('{conversationHistory}', conversationHistory)
        .replace('{relevantMessages}', relevantMessagesText)
        .replace('{topics}', context.topics.join(', '))
        .replace('{currentTime}', new Date().toLocaleString());

      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 1000,
        temperature: 0.7,
      });

      const responseText = response.choices[0].message.content || 'I apologize, but I could not generate a response.';

      // Store the interaction in memory
      await this.addToMemory(context.sender.id.toString(), {
        input: context.query,
        output: responseText,
        timestamp: new Date(),
        sender: context.sender.name,
        recipients: ['ai'],
        topics: context.topics
      });

      return responseText;
    } catch (error) {
      console.error('Error generating contextual response:', error);
      return 'I apologize, but I encountered an error while processing your request. Please try again.';
    }
  }

  private async findRelevantMessages(context: ReasoningContext): Promise<any[]> {
    const { query, timeframe } = context;
    
    // Parse query to extract intent
    const queryAnalysis = this.analyzeQuery(query);
    
    // Query Neo4j for relevant messages
    const relevantMessages = await neo4jService.findConversationContext({
      sender: queryAnalysis.targetUser,
      topic: queryAnalysis.targetTopic,
      timeframe: queryAnalysis.timeframe || timeframe,
      limit: 15
    });

    return relevantMessages;
  }

  private analyzeQuery(query: string): {
    targetUser?: string;
    targetTopic?: string;
    timeframe?: string;
  } {
    const lowerQuery = query.toLowerCase();
    
    // Extract user mentions
    const userPattern = /\b(alice|bob|john|sarah|mike|emma|david|lisa)\b/gi;
    const userMatches = query.match(userPattern);
    const targetUser = userMatches ? userMatches[0] : undefined;

    // Extract topic mentions
    const topicPattern = /\b(cybertruck|tesla|meeting|project|work|lunch|weekend|movie|book|game)\b/gi;
    const topicMatches = query.match(topicPattern);
    const targetTopic = topicMatches ? topicMatches[0] : undefined;

    // Extract timeframe
    let timeframe: string | undefined;
    if (lowerQuery.includes('last week') || lowerQuery.includes('week ago')) {
      timeframe = 'last week';
    } else if (lowerQuery.includes('yesterday') || lowerQuery.includes('day ago')) {
      timeframe = 'yesterday';
    } else if (lowerQuery.includes('last month') || lowerQuery.includes('month ago')) {
      timeframe = 'last month';
    } else if (lowerQuery.includes('hour ago') || lowerQuery.includes('last hour')) {
      timeframe = 'last hour';
    }

    return {
      targetUser,
      targetTopic,
      timeframe
    };
  }

  private getUserName(userId: number, currentUser: User): string {
    // This is a simplified mapping - in a real system, you'd fetch from storage
    const userMap: { [key: number]: string } = {
      1: 'Alice',
      2: 'Bob', 
      3: 'John',
      4: 'AI Assistant'
    };
    
    return userMap[userId] || currentUser.name;
  }

  async clearMemory(userId: string): Promise<void> {
    this.userMemories.delete(userId);
  }

  async getAllMemories(): Promise<Map<string, MemoryEntry[]>> {
    return new Map(this.userMemories);
  }
}

export const langChainService = new LangChainService();