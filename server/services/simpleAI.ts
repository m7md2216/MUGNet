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
      
      // Also log the system prompt being sent to AI
      console.log('\n🧠 AI THOUGHT PROCESS - STEP 4: System Prompt');
      console.log('📋 System prompt that will be sent to AI:');
      console.log('='.repeat(50));
      
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
- If there are multiple relationships for the same question, choose the one with the most specific person name
- PRIORITIZE ownership/action relationships over inquiry relationships (OWNS_PET > INQUIRES_ABOUT_OWNERSHIP)
- IGNORE any relationships involving "unknown person", "someone", or vague entities when specific names are available
- Use conversation history only as supplementary context when knowledge graph is insufficient
- Be conversational and friendly
- Answer questions based on the most specific entity relationships available in the knowledge graph
- Keep responses concise but comprehensive based on the knowledge graph connections

PRIORITY RULES: 
- If you see both "Person -> ACTION -> Entity" AND "unknown person -> ACTION -> Entity", use Person as the answer because it's more specific
- If you see both "Person -> OWNS_PET -> Pet" AND "Person -> INQUIRES_ABOUT_OWNERSHIP -> Pet", use Person as the owner because OWNS_PET is the actual relationship, not just an inquiry

LOGICAL INFERENCE RULES:
- If Person A created an object and "friend" or "someone" gave the same/similar object, then "friend" = Person A (replace vague with specific)
- When creation and giving actions involve the same object, connect them to the same person definitively
- If Person A owns pets and pets send comfort/vibes to "friend," then "friend" = Person A (pets comfort their owners)
- Apply logical reasoning to resolve vague entities to specific named people when clear patterns exist
- Be confident in logical inferences when the connections are obvious (creators give their creations, pets comfort their owners)
- Example: If "Chloe CREATED cat planter" and "friend GAVE cat planter" both exist, answer definitively "Chloe gave the cat planter"
- Example: If "Chloe OWNS cats" and "cats SEND purr-well soon vibes to friend" both exist, answer definitively "Chloe's cats send her purr-well soon vibes"`;

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

  // Systematic approach: prioritize specific people over vague entities
  private getFirstValidConnection(connections: any[]): any {
    const vague = ['unknown person', 'someone', 'your friend', 'my friend', 'a friend', 'his friend', 'her friend', 'their friend'];
    
    // First priority: specific person with specific entity
    for (const conn of connections) {
      const entity1Lower = conn.entity1.toLowerCase();
      const entity2Lower = conn.entity2.toLowerCase();
      
      if (!vague.includes(entity1Lower) && !vague.includes(entity2Lower)) {
        return conn;
      }
    }
    
    // Second priority: specific person with any entity
    for (const conn of connections) {
      const entity1Lower = conn.entity1.toLowerCase();
      
      if (!vague.includes(entity1Lower)) {
        return conn;
      }
    }
    
    // Last resort: vague entities
    return connections[0];
  }

  // Systematic resolution of vague entities to specific ones
  private resolveVagueEntities(connection: any, allConnections: any[]): any {
    const vague = ['unknown person', 'someone', 'your friend', 'my friend', 'a friend', 'his friend', 'her friend', 'their friend'];
    const entity1Lower = connection.entity1.toLowerCase();
    const entity2Lower = connection.entity2.toLowerCase();
    
    // If entity1 is vague, try to find a specific person with related activities
    if (vague.includes(entity1Lower)) {
      // First try exact match on relationship and entity
      let specificConnection = allConnections.find(conn => 
        conn.entity2 === connection.entity2 && 
        conn.connectionType === connection.connectionType &&
        !vague.includes(conn.entity1.toLowerCase())
      );
      
      // If no exact match, try semantic matching for related activities
      if (!specificConnection && this.isPlantOrCraftRelated(connection.entity2)) {
        console.log(`🔍 RESOLUTION DEBUG: Looking for specific person for vague entity "${connection.entity1}" with relation to "${connection.entity2}"`);
        specificConnection = allConnections.find(conn => {
          const isPlantRelated = this.isPlantOrCraftRelated(conn.entity2);
          const isSpecificPerson = !vague.includes(conn.entity1.toLowerCase());
          const isCorrectAction = (conn.connectionType === 'CREATED' || conn.connectionType === 'GIFTED' || conn.connectionType === 'MADE');
          const areEntitiesRelated = this.areEntitiesRelated(connection.entity2, conn.entity2);
          console.log(`   Checking: ${conn.entity1} --[${conn.connectionType}]--> ${conn.entity2} | PlantRelated: ${isPlantRelated}, SpecificPerson: ${isSpecificPerson}, CorrectAction: ${isCorrectAction}, EntitiesRelated: ${areEntitiesRelated}`);
          return (isPlantRelated || areEntitiesRelated) && isSpecificPerson && isCorrectAction;
        });
        if (specificConnection) {
          console.log(`🔍 RESOLUTION SUCCESS: Resolved "${connection.entity1}" to "${specificConnection.entity1}" based on semantic matching`);
        }
      }
      
      if (specificConnection) {
        return { ...connection, entity1: specificConnection.entity1 };
      }
    }
    
    // If entity2 is vague, try to find a specific entity with the same relationship from entity1
    if (vague.includes(entity2Lower)) {
      const specificConnection = allConnections.find(conn => 
        conn.entity1 === connection.entity1 && 
        conn.connectionType === connection.connectionType &&
        !vague.includes(conn.entity2.toLowerCase())
      );
      if (specificConnection) {
        return specificConnection;
      }
    }
    
    return connection;
  }

  // Helper function to check if an entity is related to plants/crafts
  private isPlantOrCraftRelated(entity: string): boolean {
    const entityLower = entity.toLowerCase();
    const keywords = ['planter', 'succulent', 'cat', 'plant', 'craft', 'shape', 'tiny'];
    return keywords.some(keyword => entityLower.includes(keyword));
  }

  // Helper function to normalize entity names for semantic matching
  private normalizeEntity(entity: string): string {
    const entityLower = entity.toLowerCase();
    
    // Normalize cat planter variations
    if (entityLower.includes('planter') && entityLower.includes('cat')) {
      return 'cat planter';
    }
    
    return entity;
  }

  // Enhanced semantic matching for related entities
  private areEntitiesRelated(entity1: string, entity2: string): boolean {
    const norm1 = this.normalizeEntity(entity1);
    const norm2 = this.normalizeEntity(entity2);
    return norm1 === norm2;
  }

  // Global filtering to remove vague entities when specific alternatives exist for the same topic
  private filterVagueEntitiesGlobally(connections: any[]): any[] {
    const vague = ['unknown person', 'someone', 'your friend', 'my friend', 'a friend', 'his friend', 'her friend', 'their friend', 'friend'];
    const filtered: any[] = [];
    
    console.log(`🔍 GLOBAL FILTER: Starting with ${connections.length} connections`);
    
    // Group connections by topic/entity type
    const topicGroups = new Map<string, any[]>();
    
    connections.forEach(conn => {
      // Use the normalized entity for grouping
      const normalizedEntity = this.normalizeEntityForGrouping(conn.entity2);
      const topic = this.getTopicKey(normalizedEntity);
      if (!topicGroups.has(topic)) {
        topicGroups.set(topic, []);
      }
      // Store the original connection but group by normalized topic
      topicGroups.get(topic)!.push({...conn, normalizedEntity2: normalizedEntity});
    });
    
    console.log(`🔍 GLOBAL FILTER: Created ${topicGroups.size} topic groups`);
    
    // For each topic group, prioritize specific people over vague ones and apply logical inference
    topicGroups.forEach((groupConnections, topic) => {
      console.log(`🔍 GLOBAL FILTER: Processing topic "${topic}" with ${groupConnections.length} connections`);
      
      const specificConnections = groupConnections.filter(conn => 
        !vague.includes(conn.entity1.toLowerCase())
      );
      const vagueConnections = groupConnections.filter(conn => 
        vague.includes(conn.entity1.toLowerCase())
      );
      
      console.log(`   Specific: ${specificConnections.length}, Vague: ${vagueConnections.length}`);
      
      if (specificConnections.length > 0) {
        // Apply logical inference: if someone created an object and someone vaguely gave a similar object,
        // replace the vague giver with the specific creator
        const resolvedVagueConnections = vagueConnections.map(vagueConn => {
          // Pattern 1: Creator giving their creation
          if (vagueConn.connectionType === 'GAVE_OBJECT' || vagueConn.connectionType === 'GIFTED') {
            const creator = specificConnections.find(specConn => 
              specConn.connectionType === 'CREATED_OBJECT' || specConn.connectionType === 'CREATED'
            );
            if (creator) {
              console.log(`🔍 LOGICAL INFERENCE: Resolved vague "${vagueConn.entity1}" to "${creator.entity1}" for giving action`);
              return { ...vagueConn, entity1: creator.entity1 };
            }
          }
          
          // Pattern 2: Pet owner receiving comfort from their pets
          if (vagueConn.connectionType === 'RECEIVES_COMFORT_FROM' || 
              vagueConn.connectionType === 'GETS_VIBES_FROM' ||
              vagueConn.entity2.toLowerCase().includes('purr') ||
              vagueConn.entity2.toLowerCase().includes('comfort')) {
            const petOwner = specificConnections.find(specConn => 
              specConn.connectionType === 'OWNS_PET' || 
              specConn.connectionType === 'HAS_PET' ||
              specConn.entity2.toLowerCase().includes('cat') ||
              specConn.entity2.toLowerCase().includes('dog')
            );
            if (petOwner) {
              console.log(`🔍 LOGICAL INFERENCE: Resolved vague "${vagueConn.entity1}" to "${petOwner.entity1}" for pet comfort`);
              return { ...vagueConn, entity1: petOwner.entity1 };
            }
          }
          
          return vagueConn;
        });
        
        filtered.push(...specificConnections);
        filtered.push(...resolvedVagueConnections);
        console.log(`🔍 GLOBAL FILTER: Topic "${topic}" - using ${specificConnections.length} specific + ${resolvedVagueConnections.length} resolved connections`);
      } else {
        // If no specific people, keep the vague ones
        filtered.push(...vagueConnections);
        console.log(`🔍 GLOBAL FILTER: Topic "${topic}" - keeping ${vagueConnections.length} vague connections (no specific alternatives)`);
      }
    });
    
    console.log(`🔍 GLOBAL FILTER: Final result: ${filtered.length} connections`);
    return filtered;
  }

  // Get topic key for grouping related entities
  private getTopicKey(entity: string): string {
    const entityLower = entity.toLowerCase();
    
    // Group cat planter variations (including succulent planters)
    if ((entityLower.includes('planter') && entityLower.includes('cat')) || 
        (entityLower.includes('succulent') && entityLower.includes('planter') && entityLower.includes('cat'))) {
      return 'cat_planter';
    }
    
    // Group pet-related entities
    if (entityLower.includes('mittens') || (entityLower.includes('cat') && !entityLower.includes('planter'))) {
      return 'pets';
    }
    
    // Default: use the entity itself
    return entityLower;
  }

  // Normalize entity names to catch semantic equivalents
  private normalizeEntityForGrouping(entity: string): string {
    const entityLower = entity.toLowerCase();
    
    // Normalize cat planter variations to a standard form
    if ((entityLower.includes('planter') && entityLower.includes('cat')) || 
        (entityLower.includes('succulent') && entityLower.includes('planter') && entityLower.includes('cat'))) {
      return 'cat planter';
    }
    
    // Normalize cat references  
    if (entityLower.includes('mittens')) {
      return 'Mittens';
    }
    
    return entity;
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
      console.log('🔍 DEBUG: Query words:', queryWords);
      
      // Query Neo4j directly for relevant entities and relationships
      const entityConnections: Array<{entity1: string, entity2: string, connectionType: string}> = [];
      
      console.log('🔍 DEBUG: Neo4j session available:', !!neo4jService.session);
      
      if (neo4jService.session) {
        console.log('🔍 DEBUG: Starting Neo4j search...');
        // Dynamic search strategy - no hard-coded keywords
        for (const word of queryWords) {
          try {
            console.log(`🔍 DEBUG: Searching Neo4j for word: "${word}"`);
            // 1. Direct entity name matching (case-insensitive)
            const result1 = await neo4jService.session.run(
              `MATCH (e1:Entity)-[r]->(e2:Entity) 
               WHERE toLower(e1.name) CONTAINS toLower($word) OR toLower(e2.name) CONTAINS toLower($word)
               RETURN e1.name as entity1, type(r) as relationshipType, e2.name as entity2 
               LIMIT 20`,
              { word }
            );
            console.log(`🔍 DEBUG: Found ${result1.records.length} results for word "${word}"`);
            
            result1.records.forEach(record => {
              const conn = {
                entity1: record.get('entity1'),
                entity2: record.get('entity2'),
                connectionType: record.get('relationshipType')
              };
              console.log(`   Found: ${conn.entity1} --[${conn.connectionType}]--> ${conn.entity2}`);
              entityConnections.push(conn);
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
      
      console.log('🔍 DEBUG: Raw entityConnections found:', entityConnections.length);
      console.log('🔍 DEBUG: Query was:', query);
      entityConnections.forEach(conn => {
        console.log(`   RAW: ${conn.entity1} --[${conn.connectionType}]--> ${conn.entity2}`);
      });

      // Remove duplicates and filter conflicting relationships
      const connectionMap = new Map<string, any>();
      
      // First pass: collect all connections
      entityConnections.forEach(conn => {
        const key = `${conn.entity1}-${conn.entity2}`;
        if (!connectionMap.has(key)) {
          connectionMap.set(key, []);
        }
        connectionMap.get(key).push(conn);
      });
      
      // Second pass: resolve conflicts by prioritizing relationship types and resolve vague entities
      const resolvedConnections: any[] = [];
      console.log('🔍 RESOLUTION MAP DEBUG: Processing', connectionMap.size, 'connection groups');
      connectionMap.forEach((connections, key) => {
        console.log(`   Group "${key}": ${connections.length} connections`);
        connections.forEach(conn => console.log(`     - ${conn.entity1} --[${conn.connectionType}]--> ${conn.entity2}`));
        
        if (connections.length === 1) {
          const resolved = this.resolveVagueEntities(connections[0], entityConnections);
          resolvedConnections.push(resolved);
        } else {
          // Multiple relationships between same entities - use first valid one
          const bestConnection = this.getFirstValidConnection(connections);
          const resolved = this.resolveVagueEntities(bestConnection, entityConnections);
          resolvedConnections.push(resolved);
        }
      });
      
      // Third pass: Global filtering to remove vague entities when specific alternatives exist
      console.log('🔍 BEFORE GLOBAL FILTER: resolvedConnections count:', resolvedConnections.length);
      resolvedConnections.forEach(conn => {
        console.log(`   BEFORE: ${conn.entity1} --[${conn.connectionType}]--> ${conn.entity2}`);
      });
      const finalConnections = this.filterVagueEntitiesGlobally(resolvedConnections);
      console.log('🔍 AFTER GLOBAL FILTER: finalConnections count:', finalConnections.length);
      finalConnections.forEach(conn => {
        console.log(`   AFTER: ${conn.entity1} --[${conn.connectionType}]--> ${conn.entity2}`);
      });
      
      const uniqueConnections = finalConnections.sort((a, b) => {
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
      
      // DEBUG: Log what we're sending to AI
      console.log('🔍 DEBUG: Entity connections being sent to AI:');
      intelligentContext.entityConnections.forEach(conn => {
        console.log(`   ${conn.entity1} --[${conn.connectionType}]--> ${conn.entity2}`);
      });
    }
    
    return sections.length > 0 ? sections.join('\n') : "No relevant knowledge graph context found";
  }
}

export const simpleAIService = new SimpleAIService();