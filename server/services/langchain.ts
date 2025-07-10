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
      
      // Debug logging
      console.log('=== LANGCHAIN RESPONSE DEBUG ===');
      console.log('Query:', context.query);
      console.log('Relevant messages found:', relevantMessages.length);
      console.log('Relevant messages:', relevantMessages);
      console.log('Conversation history count:', context.conversationHistory.length);
      console.log('Recent messages:', context.conversationHistory.slice(-5).map(msg => `${msg.id}: ${msg.content}`));
      
      // Format conversation history
      const conversationHistory = context.conversationHistory
        .slice(-10) // Last 10 messages for context
        .map(msg => `${this.getUserName(msg.userId, context.sender)}: ${msg.content}`)
        .join('\n');

      // Format relevant messages
      const relevantMessagesText = relevantMessages.length > 0
        ? relevantMessages.map(msg => 
            `${msg.sender || this.getUserName(msg.userId, context.sender)} (${new Date(msg.timestamp || msg.createdAt).toLocaleDateString()}): ${msg.content}`
          ).join('\n')
        : 'No specific relevant messages found.';

      console.log('Formatted relevant messages text:', relevantMessagesText);

      // Generate response using the prompt template
      const prompt = this.promptTemplate
        .replace('{query}', context.query)
        .replace('{sender}', context.sender.name)
        .replace('{conversationHistory}', conversationHistory)
        .replace('{relevantMessages}', relevantMessagesText)
        .replace('{topics}', context.topics.join(', '))
        .replace('{currentTime}', new Date().toLocaleString());

      console.log('Full prompt to AI:', prompt);

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
    const searchTerms = await this.extractSearchTerms(query, context.conversationHistory);
    console.log('AI-extracted search terms from query:', searchTerms);
    
    // Check if we can find message ID 9 which contains the beach mention
    const beachMessage = context.conversationHistory.find(msg => msg.id === 9);
    if (beachMessage) {
      console.log('Found beach message ID 9:', beachMessage.content);
    } else {
      console.log('Beach message ID 9 not found in conversation history');
    }
    
    console.log('All available messages:', context.conversationHistory.map(msg => `${msg.id}: ${msg.content}`));
    
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
    try {
      // Use OpenAI to intelligently extract entities from conversation history
      const conversationSample = conversationHistory
        .slice(-20) // Last 20 messages for context
        .map(msg => msg.content)
        .join('\n');

      const extractionPrompt = `Analyze this conversation history and extract entities, then analyze the user query for intent.

Conversation History:
${conversationSample}

User Query: "${query}"

Extract and return JSON with:
1. "users" - array of all person names mentioned in conversation
2. "topics" - array of all activities, places, objects, subjects discussed
3. "targetUser" - which user (if any) the query is asking about
4. "targetTopic" - which topic (if any) the query is asking about  
5. "timeframe" - time reference in query (yesterday, last week, etc.)

Focus on meaningful entities. Return valid JSON only.`;

      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [{ role: 'user', content: extractionPrompt }],
        response_format: { type: "json_object" },
        max_tokens: 500,
        temperature: 0.1
      });

      const analysis = JSON.parse(response.choices[0].message.content || '{}');
      
      return {
        targetUser: analysis.targetUser || undefined,
        targetTopic: analysis.targetTopic || undefined,
        timeframe: analysis.timeframe || undefined
      };
    } catch (error) {
      console.error('AI entity extraction failed, using fallback:', error);
      // Simple fallback
      const lowerQuery = query.toLowerCase();
      return {
        targetUser: undefined,
        targetTopic: undefined,
        timeframe: lowerQuery.includes('yesterday') ? 'yesterday' : undefined
      };
    }
  }

  private async extractSearchTerms(query: string, conversationHistory: Message[]): Promise<string[]> {
    try {
      // Use OpenAI to extract the most relevant search terms
      const searchPrompt = `Extract the most important search keywords from this query that would help find relevant messages in a conversation.

Query: "${query}"

Return a JSON array of the most important words/phrases to search for. Focus on:
- Names of people
- Activities (hiking, movies, restaurants, etc.)  
- Places (Pennsylvania, beach, etc.)
- Objects or subjects being discussed
- Action words (went, watched, discussed, mentioned)

Return only the JSON array of strings, no other text.`;

      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [{ role: 'user', content: searchPrompt }],
        response_format: { type: "json_object" },
        max_tokens: 200,
        temperature: 0.1
      });

      const result = JSON.parse(response.choices[0].message.content || '{"terms": []}');
      return result.terms || result.keywords || Object.values(result)[0] || [];
    } catch (error) {
      console.error('AI search term extraction failed, using fallback:', error);
      // Simple word extraction fallback
      return query.toLowerCase().split(/\s+/).filter(word => 
        word.length > 2 && !['the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'can', 'had', 'was'].includes(word)
      );
    }
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