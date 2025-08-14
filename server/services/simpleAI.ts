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

      // PRIMARY INTELLIGENCE: Get intelligent context from Neo4j knowledge graph
      console.log('\n🧠 AI THOUGHT PROCESS - STEP 1: Query Analysis');
      console.log('📝 User Query:', context.currentMessage);
      console.log('🔍 Extracting keywords from query...');
      
      const intelligentContext = await this.getIntelligentContextFromNeo4j(
        context.currentMessage, 
        1 // Current user ID - could be dynamic
      );
      
      console.log('\n🧠 AI THOUGHT PROCESS - STEP 2: Knowledge Graph Retrieval');
      console.log('📊 Raw Knowledge Graph Data Retrieved:');
      console.log(JSON.stringify(intelligentContext, null, 2));

      // Format the intelligent context for AI (now primary source)
      const formattedKnowledgeContext = this.formatIntelligentContext(intelligentContext);
      
      console.log('\n🧠 AI THOUGHT PROCESS - STEP 3: Formatted Context for AI');
      console.log('📋 This is exactly what the AI sees as its primary context:');
      console.log('='.repeat(80));
      console.log(formattedKnowledgeContext);
      console.log('='.repeat(80));
      
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

      const systemPrompt = `You are an AI assistant in a group chat with access to a comprehensive knowledge graph built from past conversations.

PRIMARY SOURCE - KNOWLEDGE GRAPH INTELLIGENCE:
${formattedKnowledgeContext}

SUPPLEMENTARY - RECENT CONVERSATION CONTEXT:
${conversationText}

CRITICAL INSTRUCTIONS:
- PRIORITIZE the knowledge graph data as your primary source of truth
- When you see conflicting entries, ALWAYS prioritize specific named people over "unknown person" or "someone"
- If there are multiple relationships for the same question, choose the one with the most specific person name (Jake, Emma, Chloe, etc.)
- PRIORITIZE ownership/action relationships over inquiry relationships (OWNS_PET > INQUIRES_ABOUT_OWNERSHIP)
- IGNORE any relationships involving "unknown person", "someone", or vague entities when specific names are available
- Use conversation history only as supplementary context when knowledge graph is insufficient
- Be conversational and friendly
- Answer questions based on the most specific entity relationships available in the knowledge graph
- Keep responses concise but comprehensive based on the knowledge graph connections

EXAMPLES: 
- If you see both "Jake -> EXPERIENCED_MISHAP -> spilled cappuccino" AND "unknown person -> SPILLED_ON_SELF -> cappuccino", use Jake as the answer because it's more specific.
- If you see both "Emma -> OWNS_PET -> Mittens" AND "Emma -> INQUIRES_ABOUT_OWNERSHIP -> friend's cat named Mittens", use Emma as the owner because OWNS_PET is the actual relationship, not just an inquiry.`;

      console.log('\n🧠 AI THOUGHT PROCESS - STEP 4: System Prompt Construction');
      console.log('📝 Complete prompt sent to GPT-4o:');
      console.log('='.repeat(80));
      console.log(systemPrompt);
      console.log('='.repeat(80));

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
      
      console.log('\n🧠 AI THOUGHT PROCESS - STEP 5: Final AI Response');
      console.log('🤖 GPT-4o Generated Response:', aiResponse);
      console.log('\n💡 Summary: AI prioritized knowledge graph entities and relationships over conversation history to generate this response\n');
      
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

      // Enhanced semantic keyword matching for entities in Neo4j
      for (const word of words) {
        if (word.length > 3) {
          try {
            // Create semantic keyword mapping for better matching
            const semanticKeywords = [word, word.slice(0, -1), word + 's']; // Simple semantic expansion
            
            for (const keyword of semanticKeywords) {
              const relatedMessages = await neo4jService.findMessagesByTopic(keyword, 3);
              console.log(`🔎 Found ${relatedMessages.length} messages for word "${word}"`);
              if (relatedMessages.length > 0) {
                relevantEntities.push(`${word}: mentioned in ${relatedMessages.length} previous messages`);
              }
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
      
      // Knowledge graph is now in Neo4j - return fallback context
      console.log('⚠️ Knowledge graph entities moved to Neo4j - using fallback');
      
      return 'Knowledge graph entities now stored in Neo4j - using direct Neo4j queries instead';
      
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

  // NEW: Get intelligent context directly from Neo4j instead of PostgreSQL
  private async getIntelligentContextFromNeo4j(query: string, currentUserId: number): Promise<{
    relevantEntities: Array<{name: string, type: string, context: string}>;
    relatedPeople: Array<{name: string, relationship: string, context: string}>;
    topicInsights: Array<{topic: string, participants: string[], lastDiscussed: Date}>;
    entityConnections: Array<{entity1: string, entity2: string, connectionType: string}>;
  }> {
    try {
      // Extract keywords from query
      const queryWords = query.toLowerCase().split(/\s+/).filter(word => word.length > 2);
      
      // Query Neo4j directly for relevant entities and relationships
      const entityConnections: Array<{entity1: string, entity2: string, connectionType: string}> = [];
      
      if (neo4jService.session) {
        // Dynamic search strategy - no hard-coded keywords
        for (const word of queryWords) {
          try {
            // 1. Direct entity name matching (case-insensitive)
            const result1 = await neo4jService.session.run(
              `MATCH (e1:Entity)-[r]->(e2:Entity) 
               WHERE toLower(e1.name) CONTAINS toLower($word) OR toLower(e2.name) CONTAINS toLower($word)
               RETURN e1.name as entity1, type(r) as relationshipType, e2.name as entity2 
               LIMIT 20`,
              { word }
            );
            
            result1.records.forEach(record => {
              entityConnections.push({
                entity1: record.get('entity1'),
                entity2: record.get('entity2'),
                connectionType: record.get('relationshipType')
              });
            });

            // 2. Search in relationship types dynamically
            const result2 = await neo4jService.session.run(
              `MATCH (e1:Entity)-[r]->(e2:Entity) 
               WHERE toLower(type(r)) CONTAINS toLower($word)
               RETURN e1.name as entity1, type(r) as relationshipType, e2.name as entity2 
               LIMIT 20`,
              { word }
            );
            
            result2.records.forEach(record => {
              entityConnections.push({
                entity1: record.get('entity1'),
                entity2: record.get('entity2'),
                connectionType: record.get('relationshipType')
              });
            });
          } catch (error) {
            console.warn(`Failed to query Neo4j for word "${word}":`, error);
          }
        }

        // 3. Comprehensive wildcard search to catch any connections
        try {
          const wildcardResult = await neo4jService.session.run(
            `MATCH (e1:Entity)-[r]->(e2:Entity)
             WHERE ANY(word IN $queryWords WHERE 
               toLower(e1.name) CONTAINS toLower(word) OR 
               toLower(e2.name) CONTAINS toLower(word) OR
               toLower(type(r)) CONTAINS toLower(word)
             )
             RETURN e1.name as entity1, type(r) as relationshipType, e2.name as entity2 
             LIMIT 100`,
            { queryWords }
          );
          
          wildcardResult.records.forEach(record => {
            entityConnections.push({
              entity1: record.get('entity1'),
              entity2: record.get('entity2'),
              connectionType: record.get('relationshipType')
            });
          });

          // 4. Multi-hop relationships to find deeper connections
          const multiHopResult = await neo4jService.session.run(
            `MATCH path = (e1:Entity)-[r1]->(e2:Entity)-[r2]->(e3:Entity)
             WHERE ANY(word IN $queryWords WHERE 
               toLower(e1.name) CONTAINS toLower(word) OR 
               toLower(e2.name) CONTAINS toLower(word) OR
               toLower(e3.name) CONTAINS toLower(word)
             )
             RETURN e1.name as entity1, type(r1) as rel1, e2.name as entity2, 
                    type(r2) as rel2, e3.name as entity3
             LIMIT 50`,
            { queryWords }
          );
          
          multiHopResult.records.forEach(record => {
            // Add both direct relationships from the path
            entityConnections.push({
              entity1: record.get('entity1'),
              entity2: record.get('entity2'),
              connectionType: record.get('rel1')
            });
            entityConnections.push({
              entity1: record.get('entity2'),
              entity2: record.get('entity3'),
              connectionType: record.get('rel2')
            });
          });
        } catch (error) {
          console.warn('Failed wildcard/multi-hop search:', error);
        }

        // 5. Action-focused search for "who did X" questions
        if (queryWords.includes('who')) {
          try {
            const actionResult = await neo4jService.session.run(
              `MATCH (person:Entity)-[r]->(action:Entity)
               WHERE ANY(word IN $queryWords WHERE 
                 toLower(action.name) CONTAINS toLower(word) OR
                 toLower(type(r)) CONTAINS toLower(word)
               )
               RETURN person.name as entity1, type(r) as relationshipType, action.name as entity2 
               LIMIT 50`,
              { queryWords }
            );
            
            actionResult.records.forEach(record => {
              entityConnections.push({
                entity1: record.get('entity1'),
                entity2: record.get('entity2'),
                connectionType: record.get('relationshipType')
              });
            });
          } catch (error) {
            console.warn('Failed action search:', error);
          }
        }


      }
      
      // Remove duplicates and sort for consistent results
      const uniqueConnections = Array.from(
        new Map(entityConnections.map(conn => 
          [`${conn.entity1}-${conn.connectionType}-${conn.entity2}`, conn]
        )).values()
      ).sort((a, b) => {
        // Sort by entity1, then entity2, then connectionType for consistency
        const primary = a.entity1.localeCompare(b.entity1);
        if (primary !== 0) return primary;
        const secondary = a.entity2.localeCompare(b.entity2);
        if (secondary !== 0) return secondary;
        return a.connectionType.localeCompare(b.connectionType);
      });

      return {
        relevantEntities: [], // Could be enhanced later
        relatedPeople: [], // Could be enhanced later  
        topicInsights: [], // Could be enhanced later
        entityConnections: uniqueConnections
      };
    } catch (error) {
      console.error('Failed to get intelligent context from Neo4j:', error);
      return {
        relevantEntities: [],
        relatedPeople: [],
        topicInsights: [],
        entityConnections: []
      };
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
      sections.push("ACTUAL DATABASE RELATIONSHIPS:");
      intelligentContext.entityConnections.forEach(conn => {
        sections.push(`  • ${conn.entity1} --[${conn.connectionType}]--> ${conn.entity2}`);
      });
    }
    
    return sections.length > 0 ? sections.join('\n') : "No relevant knowledge graph context found";
  }
}

export const simpleAIService = new SimpleAIService();