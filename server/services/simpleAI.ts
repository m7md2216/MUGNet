import OpenAI from 'openai';
import { storage } from '../storage';
import { neo4jService } from './neo4j';
import { knowledgeGraphService } from './knowledgeGraph';

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
      // Get comprehensive conversation history for knowledge retrieval
      // Use all available history for knowledge graph queries, limit to recent for context efficiency
      const isKnowledgeQuery = context.currentMessage.toLowerCase().includes('who') || 
                               context.currentMessage.toLowerCase().includes('what') ||
                               context.currentMessage.toLowerCase().includes('when') ||
                               context.currentMessage.toLowerCase().includes('where');
      
      const historyLimit = isKnowledgeQuery ? 500 : 20; // Much more history for knowledge queries
      const recentHistory = context.conversationHistory.slice(-historyLimit);
      
      // Format conversation for AI with clear attribution
      const conversationText = recentHistory
        .map(msg => `${msg.senderName}: ${msg.content}`)
        .join('\n');

      // PRIMARY INTELLIGENCE: Get intelligent context from knowledge graph
      console.log('🧠 Getting intelligent context from knowledge graph for:', context.currentMessage);
      const intelligentContext = await knowledgeGraphService.getIntelligentContext(
        context.currentMessage, 
        1 // Current user ID - could be dynamic
      );
      console.log('✅ Intelligent context retrieved:', JSON.stringify(intelligentContext, null, 2));

      // Format the intelligent context for AI (now primary source)
      const formattedKnowledgeContext = this.formatIntelligentContext(intelligentContext);
      
      // Check if the conversation history contains the Airbnb message
      const hasAirbnbMessage = recentHistory.some(msg => 
        msg.content.toLowerCase().includes('airbnb')
      );
      
      if (hasAirbnbMessage) {
        console.log('✅ Found Airbnb message in conversation history');
        const airbnbMessage = recentHistory.find(msg => 
          msg.content.toLowerCase().includes('airbnb')
        );
        console.log('🎯 Airbnb message:', airbnbMessage);
      } else {
        console.log('❌ No Airbnb message found in conversation history');
        console.log('📝 History length:', recentHistory.length);
      }

      console.log('🤖 AI Context - Recent History:');
      console.log(conversationText);
      console.log('🤖 AI Context - Knowledge Graph Context:');
      console.log(formattedKnowledgeContext);

      const systemPrompt = `You are an AI assistant in a group chat. You have access to conversation history and knowledge about discussed topics.

RECENT CONVERSATION (supplementary context):
${conversationText}

KNOWLEDGE GRAPH INTELLIGENCE (primary context):
${formattedKnowledgeContext}

Instructions:
- Be conversational and friendly
- Reference past discussions when relevant
- Answer questions based on the conversation history shown above
- CRITICAL: When asked "who said X", look CAREFULLY at the conversation history to find the exact speaker name
- Always double-check speaker attribution before responding
- If asked about specific people or topics, use the context provided
- Keep responses concise but helpful
- Be very precise about who said what - accuracy is crucial`;

      const response = await this.openai.chat.completions.create({
        model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `${context.senderName}: ${context.currentMessage}` }
        ],
        max_tokens: 300,
        temperature: 0.3 // Lower temperature for more accurate attribution
      });

      const aiResponse = response.choices[0].message.content || "I'm having trouble responding right now.";
      console.log('🤖 AI Response:', aiResponse);
      
      return aiResponse;
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

      console.log('🔍 Getting entity context for message:', message);
      console.log('📝 Extracted words:', words);

      // Look for entities in Neo4j that match message content
      for (const word of words) {
        if (word.length > 3) {
          try {
            const relatedMessages = await neo4jService.findMessagesByTopic(word, 3);
            console.log(`🔎 Found ${relatedMessages.length} messages for word "${word}"`);
            if (relatedMessages.length > 0) {
              relevantEntities.push(`${word}: mentioned in ${relatedMessages.length} previous messages`);
            }
          } catch (wordError) {
            console.warn(`❌ Failed to search for word "${word}":`, wordError);
          }
        }
      }

      const result = relevantEntities.length > 0 
        ? relevantEntities.join('\n')
        : 'No specific context from previous conversations';
      
      console.log('📊 Entity context result:', result);
      return result;
    } catch (error) {
      console.warn('Failed to get entity context:', error);
      return 'Context unavailable';
    }
  }

  private async getEntityContextFromKnowledgeGraph(message: string): Promise<string> {
    try {
      console.log('🔍 Getting entity context from knowledge graph via storage');
      
      // Get knowledge graph entities from storage
      const allEntities = await storage.getAllKnowledgeGraphEntities();
      
      if (!allEntities || allEntities.length === 0) {
        console.log('❌ No knowledge graph entities found in storage');
        return 'No knowledge graph entities available';
      }
      
      console.log(`📊 Found ${allEntities.length} entities in knowledge graph`);
      
      // Extract key terms from the message
      const words = message.toLowerCase().split(/\s+/);
      const relevantTopics: string[] = [];
      const relevantPeople: string[] = [];
      const relevantEvents: string[] = [];
      
      // Search for relevant entities in the knowledge graph
      for (const entity of allEntities) {
        const entityName = entity.name.toLowerCase();
        
        // Check if any word in the message matches or is contained in the entity name
        for (const word of words) {
          if (word.length > 3 && (entityName.includes(word) || word.includes(entityName))) {
            switch (entity.type) {
              case 'topic':
                relevantTopics.push(entity.name);
                break;
              case 'person':
                relevantPeople.push(entity.name);
                break;
              case 'event':
                relevantEvents.push(entity.name);
                break;
            }
          }
        }
      }
      
      // Build context summary
      const contextParts = [];
      if (relevantTopics.length > 0) {
        contextParts.push(`Relevant topics: ${relevantTopics.slice(0, 5).join(', ')}`);
      }
      if (relevantPeople.length > 0) {
        contextParts.push(`Mentioned people: ${relevantPeople.slice(0, 5).join(', ')}`);
      }
      if (relevantEvents.length > 0) {
        contextParts.push(`Related events: ${relevantEvents.slice(0, 5).join(', ')}`);
      }
      
      const result = contextParts.length > 0 
        ? contextParts.join('\n')
        : 'No specific context from knowledge graph';
      
      console.log('📊 Knowledge graph context result:', result);
      return result;
      
    } catch (error) {
      console.warn('Failed to get entity context from knowledge graph:', error);
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

  // NEW: Format intelligent context from knowledge graph for AI
  private formatIntelligentContext(intelligentContext: {
    relevantEntities: Array<{name: string, type: string, context: string}>;
    relatedPeople: Array<{name: string, relationship: string, context: string}>;
    topicInsights: Array<{topic: string, participants: string[], lastDiscussed: Date}>;
    entityConnections: Array<{entity1: string, entity2: string, connectionType: string}>;
  }): string {
    const sections: string[] = [];
    
    // Relevant entities (locations, activities, etc.)
    if (intelligentContext.relevantEntities.length > 0) {
      sections.push("RELEVANT ENTITIES:");
      intelligentContext.relevantEntities.forEach(entity => {
        sections.push(`  • ${entity.name} (${entity.type}): ${entity.context}`);
      });
    }
    
    // Related people and their connections
    if (intelligentContext.relatedPeople.length > 0) {
      sections.push("RELATED PEOPLE:");
      intelligentContext.relatedPeople.forEach(person => {
        sections.push(`  • ${person.name}: ${person.context}`);
      });
    }
    
    // Topic insights (who discussed what and when)
    if (intelligentContext.topicInsights.length > 0) {
      sections.push("TOPIC INSIGHTS:");
      intelligentContext.topicInsights.forEach(insight => {
        const participantList = insight.participants.join(", ");
        sections.push(`  • "${insight.topic}": discussed by ${participantList}, last on ${insight.lastDiscussed.toLocaleDateString()}`);
      });
    }
    
    // Entity connections (how things relate to each other)
    if (intelligentContext.entityConnections.length > 0) {
      sections.push("CONNECTIONS:");
      intelligentContext.entityConnections.forEach(conn => {
        sections.push(`  • ${conn.entity1} → ${conn.entity2} (${conn.connectionType})`);
      });
    }
    
    return sections.length > 0 ? sections.join('\n') : "No relevant knowledge graph context found";
  }
}

export const simpleAIService = new SimpleAIService();