import { User, Message } from '@shared/schema';
import { langChainService } from './langchain';
import { neo4jService } from './neo4j';
import OpenAI from 'openai';

interface AgentState {
  query: string;
  sender: User;
  conversationHistory: Message[];
  intent: 'memory_lookup' | 'graph_lookup' | 'general_chat' | 'unknown';
  relevantContext: any[];
  topics: string[];
  timeframe?: string;
  response?: string;
}

export class LangGraphService {
  private openai: OpenAI;
  
  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
    // Initialize Neo4j connection
    this.initializeServices();
  }
  
  private async initializeServices(): Promise<void> {
    try {
      await neo4jService.connect();
    } catch (error) {
      console.warn('Neo4j initialization failed, continuing without graph features:', error);
    }
  }

  async processQuery(
    query: string,
    sender: User,
    conversationHistory: Message[]
  ): Promise<string> {
    try {
      // Create initial state
      const state: AgentState = {
        query,
        sender,
        conversationHistory,
        intent: 'unknown',
        relevantContext: [],
        topics: [],
      };

      // Step 1: Parse intent
      await this.parseIntent(state);

      // Step 2: Route based on intent
      switch (state.intent) {
        case 'memory_lookup':
          await this.memoryLookup(state);
          break;
        case 'graph_lookup':
          await this.graphLookup(state);
          break;
        default:
          // For general chat, we'll still add some context
          state.relevantContext = [];
          break;
      }

      // Step 3: Generate response
      await this.generateResponse(state);

      return state.response || 'I apologize, but I couldn\'t process your request.';
    } catch (error) {
      console.error('Error processing query with LangGraph:', error);
      return 'I apologize, but I encountered an error while processing your request.';
    }
  }

  private async parseIntent(state: AgentState): Promise<void> {
    const { query } = state;

    try {
      console.log('=== LANGGRAPH INTENT PARSING ===');
      console.log('Query:', query);

      // Use OpenAI to analyze the query intelligently
      const analysisResponse = await this.openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: `You are a query analysis system. Analyze the user's query and extract:
1. Intent: "memory_lookup" (asking about past conversations/memories), "graph_lookup" (asking about specific people/topics/events), or "general_chat" (greetings, thanks, etc.)
2. Topics: Extract key topics/subjects mentioned (like "beach", "hiking", "work", "movie", etc.)
3. Timeframe: Extract time references (like "yesterday", "last week", "the other day", etc.)
4. Target users: Extract any specific people mentioned

Return JSON in this format:
{
  "intent": "memory_lookup" | "graph_lookup" | "general_chat",
  "topics": ["topic1", "topic2", ...],
  "timeframe": "timeframe or null",
  "targetUsers": ["user1", "user2", ...],
  "explanation": "brief explanation of analysis"
}`
          },
          {
            role: "user",
            content: query
          }
        ],
        response_format: { type: "json_object" },
        max_tokens: 500,
      });

      const analysis = JSON.parse(analysisResponse.choices[0].message.content || "{}");
      
      console.log('OpenAI Analysis:', analysis);
      
      // Set state based on OpenAI analysis
      state.intent = analysis.intent || 'unknown';
      state.topics = analysis.topics || [];
      state.timeframe = analysis.timeframe || undefined;
      
      console.log('Intent determined:', state.intent);
      console.log('Topics extracted:', state.topics);
      console.log('Timeframe extracted:', state.timeframe);
      console.log('Explanation:', analysis.explanation);
      
    } catch (error) {
      console.error('Error in OpenAI query analysis:', error);
      // Fallback to unknown intent
      state.intent = 'unknown';
      state.topics = [];
      state.timeframe = undefined;
    }
  }

  private async memoryLookup(state: AgentState): Promise<void> {
    // This node handles queries that can be answered from conversation memory
    const { sender } = state;
    
    try {
      const memory = await langChainService.getOrCreateMemory(sender.id.toString());
      state.relevantContext = memory.slice(-10); // Get last 10 memory entries
    } catch (error) {
      console.error('Memory lookup failed:', error);
      state.relevantContext = [];
    }
  }

  private async graphLookup(state: AgentState): Promise<void> {
    // This node handles queries that require graph database lookups
    const { query, timeframe, topics } = state;
    
    try {
      console.log('=== LANGGRAPH GRAPH LOOKUP ===');
      console.log('Query:', query);
      console.log('Topics:', topics);
      console.log('Timeframe:', timeframe);
      
      // Use OpenAI to extract search parameters intelligently
      const searchResponse = await this.openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: `You are a search parameter extraction system. Given a query, extract search parameters for finding relevant messages in a conversation history.

Return JSON in this format:
{
  "searchTerms": ["term1", "term2", ...], 
  "targetUser": "username or null",
  "targetTopic": "topic or null",
  "timeframe": "timeframe or null",
  "explanation": "brief explanation"
}`
          },
          {
            role: "user",
            content: query
          }
        ],
        response_format: { type: "json_object" },
        max_tokens: 300,
      });

      const searchParams = JSON.parse(searchResponse.choices[0].message.content || "{}");
      
      console.log('OpenAI Search Parameters:', searchParams);
      
      // Query Neo4j for relevant context
      const relevantMessages = await neo4jService.findConversationContext({
        sender: searchParams.targetUser,
        topic: searchParams.targetTopic || (topics.length > 0 ? topics[0] : undefined),
        timeframe: timeframe || searchParams.timeframe,
        limit: 10
      });

      console.log('Neo4j returned messages:', relevantMessages.length);
      
      state.relevantContext = relevantMessages;
    } catch (error) {
      console.error('Graph lookup failed:', error);
      state.relevantContext = [];
    }
  }

  private async generateResponse(state: AgentState): Promise<void> {
    const { query, sender, conversationHistory, relevantContext, topics, timeframe } = state;
    
    try {
      const response = await langChainService.generateContextualResponse({
        query,
        sender,
        conversationHistory,
        relevantMessages: relevantContext,
        topics,
        timeframe,
      });

      state.response = response;
    } catch (error) {
      console.error('Response generation failed:', error);
      state.response = 'I apologize, but I encountered an error while processing your request.';
    }
  }

  private isMemoryQuery(query: string): boolean {
    const memoryPatterns = [
      /what did (i|we) (say|talk|discuss)/,
      /do you remember/,
      /last time (i|we)/,
      /earlier (i|we)/,
    ];

    return memoryPatterns.some(pattern => pattern.test(query));
  }

  private isGraphQuery(query: string): boolean {
    const graphPatterns = [
      /what did .+ say about/,
      /who was .+ talking to/,
      /when did .+ mention/,
      /who said .+ about/,
      /find .+ conversation/,
      /search for .+ message/,
      /who went to/,
      /who was at/,
      /who visited/,
      /who did/,
      /what happened/,
      /where did .+ go/,
      /where was .+ going/,
      /who .+ about/,
      /what .+ about/,
      /where .+ about/,
      /when .+ about/,
      /who .+ to/,
      /who .+ the/,
      /who .+ beach/,
      /who .+ day/,
      /who .+ other/,
    ];

    console.log('=== LANGGRAPH GRAPH QUERY CHECK ===');
    console.log('Query:', query);
    console.log('Patterns matching:', graphPatterns.filter(p => p.test(query)));

    return graphPatterns.some(pattern => pattern.test(query));
  }

  private isGeneralChat(query: string): boolean {
    const generalPatterns = [
      /^(hi|hello|hey|good morning|good afternoon|good evening)/,
      /how are you/,
      /what's up/,
      /thank you/,
      /thanks/,
    ];

    return generalPatterns.some(pattern => pattern.test(query));
  }

  private extractTopics(query: string): string[] {
    const topicPatterns = [
      /cybertruck/gi,
      /tesla/gi,
      /meeting/gi,
      /project/gi,
      /work/gi,
      /lunch/gi,
      /weekend/gi,
      /movie/gi,
      /book/gi,
      /game/gi,
      /beach/gi,
      /hiking/gi,
      /vacation/gi,
      /travel/gi,
      /trip/gi,
    ];

    const topics: string[] = [];
    topicPatterns.forEach(pattern => {
      const matches = query.match(pattern);
      if (matches) {
        topics.push(...matches.map(match => match.toLowerCase()));
      }
    });

    return [...new Set(topics)]; // Remove duplicates
  }

  private extractTimeframe(query: string): string | undefined {
    const timeframePatterns = [
      { pattern: /last week|week ago/gi, value: 'last week' },
      { pattern: /yesterday|day ago/gi, value: 'yesterday' },
      { pattern: /last month|month ago/gi, value: 'last month' },
      { pattern: /hour ago|last hour/gi, value: 'last hour' },
    ];

    for (const { pattern, value } of timeframePatterns) {
      if (pattern.test(query)) {
        return value;
      }
    }

    return undefined;
  }

  private analyzeGraphQuery(query: string): {
    targetUser?: string;
    targetTopic?: string;
    timeframe?: string;
  } {
    const lowerQuery = query.toLowerCase();
    
    // Extract user mentions
    const userPattern = /\b(alice|bob|john|sarah|mike|emma|david|lisa|mohammad|ali)\b/gi;
    const userMatches = query.match(userPattern);
    const targetUser = userMatches ? userMatches[0] : undefined;

    // Extract topic mentions  
    const topicPattern = /\b(cybertruck|tesla|meeting|project|work|lunch|weekend|movie|book|game|beach|hiking|vacation|travel|trip)\b/gi;
    const topicMatches = query.match(topicPattern);
    const targetTopic = topicMatches ? topicMatches[0] : undefined;

    // Extract timeframe
    const timeframe = this.extractTimeframe(query);

    return {
      targetUser,
      targetTopic,
      timeframe
    };
  }


}

export const langGraphService = new LangGraphService();