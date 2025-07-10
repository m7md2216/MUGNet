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
    
    // Parse query to extract intent using actual conversation data
    const queryAnalysis = await this.analyzeQuery(query, context.conversationHistory);
    
    try {
      // Try Neo4j for relevant messages
      const relevantMessages = await neo4jService.findConversationContext({
        sender: queryAnalysis.targetUser,
        topic: queryAnalysis.targetTopic,
        timeframe: queryAnalysis.timeframe || timeframe,
        limit: 15
      });

      if (relevantMessages.length > 0) {
        return relevantMessages;
      }
    } catch (error) {
      console.warn('Neo4j search failed, falling back to direct conversation history search:', error);
    }

    // Fallback: Search conversation history directly for keywords
    const searchTerms = this.extractSearchTerms(query);
    console.log('Search terms extracted from query:', searchTerms);
    
    const relevantMessages = context.conversationHistory.filter(msg => {
      const content = msg.content.toLowerCase();
      const matches = searchTerms.some(term => content.includes(term.toLowerCase()));
      if (matches) {
        console.log(`Found relevant message: "${msg.content}" - matched terms: ${searchTerms.filter(term => content.includes(term.toLowerCase()))}`);
      }
      return matches;
    });

    console.log(`Found ${relevantMessages.length} relevant messages out of ${context.conversationHistory.length} total`);
    return relevantMessages.slice(-10); // Return last 10 relevant messages
  }

  private async analyzeQuery(query: string, conversationHistory: Message[]): Promise<{
    targetUser?: string;
    targetTopic?: string;
    timeframe?: string;
  }> {
    const lowerQuery = query.toLowerCase();
    
    // Dynamically extract all mentioned names from conversation history
    const allUsers = new Set<string>();
    conversationHistory.forEach(msg => {
      // Extract capitalized words that could be names
      const names = msg.content.match(/\b[A-Z][a-z]+\b/g);
      if (names) {
        names.forEach(name => allUsers.add(name.toLowerCase()));
      }
    });
    
    // Check if any of these users are mentioned in the query
    const targetUser = Array.from(allUsers).find(user => 
      lowerQuery.includes(user) || query.toLowerCase().includes(`@${user}`)
    );

    // Dynamically extract topics from conversation content
    const allTopics = new Set<string>();
    conversationHistory.forEach(msg => {
      // Extract meaningful words (not common words)
      const words = msg.content.toLowerCase().match(/\b[a-z]{3,}\b/g);
      if (words) {
        words.forEach(word => {
          // Skip common words
          if (!['the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'can', 'had', 'was', 'one', 'our', 'out', 'day', 'get', 'use', 'man', 'new', 'now', 'way', 'may', 'say', 'each', 'which', 'she', 'how', 'its', 'said', 'what', 'when', 'where', 'who', 'will', 'more', 'than', 'very', 'even', 'back', 'good', 'come', 'could', 'like', 'time', 'into', 'year', 'your', 'just', 'know', 'take', 'people', 'them', 'see', 'him', 'two', 'her', 'would', 'there', 'been', 'many', 'some', 'make', 'well', 'look', 'first', 'also', 'after', 'work', 'life', 'only', 'think', 'over', 'such', 'most', 'give', 'find', 'place', 'still', 'hand', 'old', 'great', 'little', 'before', 'want', 'went', 'about', 'this', 'that', 'they', 'have', 'from', 'with', 'were'].includes(word)) {
            allTopics.add(word);
          }
        });
      }
    });
    
    // Check if any topics are mentioned in the query
    const targetTopic = Array.from(allTopics).find(topic => 
      lowerQuery.includes(topic)
    );

    // Extract timeframe
    let timeframe: string | undefined;
    if (lowerQuery.includes('last week') || lowerQuery.includes('week ago')) {
      timeframe = 'last week';
    } else if (lowerQuery.includes('yesterday') || lowerQuery.includes('day ago') || lowerQuery.includes('other day')) {
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

  private extractSearchTerms(query: string): string[] {
    const lowerQuery = query.toLowerCase();
    const terms: string[] = [];
    
    // Extract all meaningful words from the query (3+ characters, not common words)
    const words = lowerQuery.match(/\b[a-z]{3,}\b/g);
    if (words) {
      words.forEach(word => {
        // Skip very common words but include everything else
        if (!['the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'can', 'had', 'was', 'one', 'our', 'out', 'day', 'get', 'use', 'man', 'new', 'now', 'way', 'may', 'say', 'each', 'which', 'she', 'how', 'its', 'said', 'what', 'when', 'where', 'who', 'will', 'more', 'than', 'very', 'even', 'back', 'good', 'come', 'could', 'like', 'time', 'into', 'year', 'your', 'just', 'know', 'take', 'people', 'them', 'see', 'him', 'two', 'her', 'would', 'there', 'been', 'many', 'some', 'make', 'well', 'look', 'first', 'also', 'after', 'work', 'life', 'only', 'think', 'over', 'such', 'most', 'give', 'find', 'place', 'still', 'hand', 'old', 'great', 'little', 'before', 'want', 'went', 'about', 'this', 'that', 'they', 'have', 'from', 'with', 'were'].includes(word)) {
          terms.push(word);
        }
      });
    }
    
    return terms;
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