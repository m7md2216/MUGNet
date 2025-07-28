import { storage } from "../storage";
import { type KnowledgeGraphEntity, type KnowledgeGraphRelationship, type Message } from "@shared/schema";

export interface GraphNode {
  id: number;
  name: string;
  type: string;
  properties: any;
  connections: number;
}

export interface GraphRelationship {
  id: number;
  from: number;
  to: number;
  type: string;
  properties: any;
}

export interface KnowledgeGraphData {
  nodes: GraphNode[];
  relationships: GraphRelationship[];
  conversationThreads: ConversationThreadSummary[];
  entitySummaries: EntitySummary[];
}

export interface ConversationThreadSummary {
  id: number;
  topic: string;
  participants: string[];
  messageCount: number;
  lastMessageAt: Date;
}

export interface EntitySummary {
  name: string;
  type: string;
  mentions: number;
  relatedEntities: string[];
  lastMentioned: Date;
}

export class KnowledgeGraphService {
  async getGraphData(): Promise<KnowledgeGraphData> {
    const entities = await storage.getAllKnowledgeGraphEntities();
    const relationships = await storage.getAllKnowledgeGraphRelationships();
    const threads = await storage.getAllConversationThreads();

    // Create nodes with connection counts
    const nodes: GraphNode[] = entities.map(entity => ({
      id: entity.id,
      name: entity.name,
      type: entity.type,
      properties: entity.properties,
      connections: this.getConnectionCount(entity.id, relationships)
    }));

    // Create relationship data
    const graphRelationships: GraphRelationship[] = relationships.map(rel => ({
      id: rel.id,
      from: rel.fromEntityId!,
      to: rel.toEntityId!,
      type: rel.relationshipType,
      properties: rel.properties
    }));

    // Create conversation thread summaries
    const conversationThreads: ConversationThreadSummary[] = threads.map(thread => ({
      id: thread.id,
      topic: thread.topic,
      participants: thread.participants || [],
      messageCount: thread.messageIds?.length || 0,
      lastMessageAt: thread.lastMessageAt!
    }));

    return {
      nodes,
      relationships: graphRelationships,
      conversationThreads,
      entitySummaries: await this.generateEntitySummaries(entities, relationships)
    };
  }

  // NEW: Smart context retrieval for AI based on relationships
  async getIntelligentContext(query: string, currentUserId: number): Promise<{
    relevantEntities: Array<{name: string, type: string, context: string}>;
    relatedPeople: Array<{name: string, relationship: string, context: string}>;
    topicInsights: Array<{topic: string, participants: string[], lastDiscussed: Date}>;
    entityConnections: Array<{entity1: string, entity2: string, connectionType: string}>;
  }> {
    try {
      const entities = await storage.getAllKnowledgeGraphEntities();
      const relationships = await storage.getAllKnowledgeGraphRelationships();
      const messages = await storage.getAllMessages(); // Get all messages for comprehensive analysis
      
      // Extract keywords from the query
      const queryWords = query.toLowerCase().split(/\s+/).filter(word => word.length > 2);
      
      // Find relevant entities based on query
      const relevantEntities = entities.filter(entity => 
        queryWords.some(word => 
          entity.name.toLowerCase().includes(word) || 
          word.includes(entity.name.toLowerCase())
        )
      ).map(entity => ({
        name: entity.name,
        type: entity.type,
        context: this.getEntityContext(entity, messages, relationships)
      }));

      // Find related people through relationships
      const relatedPeople = await this.findRelatedPeople(queryWords, relationships, entities);
      
      // Find topic insights
      const topicInsights = await this.getTopicInsights(queryWords, messages);
      
      // Find entity connections
      const entityConnections = this.findEntityConnections(relevantEntities, relationships, entities);
      
      return {
        relevantEntities,
        relatedPeople,
        topicInsights,
        entityConnections
      };
    } catch (error) {
      console.error('Failed to get intelligent context:', error);
      return {
        relevantEntities: [],
        relatedPeople: [],
        topicInsights: [],
        entityConnections: []
      };
    }
  }

  private async findRelatedPeople(queryWords: string[], relationships: any[], entities: any[]): Promise<Array<{name: string, relationship: string, context: string}>> {
    // Find people entities that have relationships to query topics
    const peopleEntities = entities.filter(e => e.type === 'person');
    const relatedPeople: Array<{name: string, relationship: string, context: string}> = [];
    
    for (const person of peopleEntities) {
      // Find what this person is connected to
      const personRelationships = relationships.filter(r => 
        r.fromEntityId === person.id || r.toEntityId === person.id
      );
      
      for (const rel of personRelationships) {
        const connectedEntityId = rel.fromEntityId === person.id ? rel.toEntityId : rel.fromEntityId;
        const connectedEntity = entities.find(e => e.id === connectedEntityId);
        
        if (connectedEntity && queryWords.some(word => 
          connectedEntity.name.toLowerCase().includes(word)
        )) {
          relatedPeople.push({
            name: person.name,
            relationship: rel.relationshipType,
            context: `Connected to ${connectedEntity.name} via ${rel.relationshipType}`
          });
        }
      }
    }
    
    return relatedPeople;
  }

  private async getTopicInsights(queryWords: string[], messages: any[]): Promise<Array<{topic: string, participants: string[], lastDiscussed: Date}>> {
    // Group messages by topics mentioned in query
    const topicInsights: Array<{topic: string, participants: string[], lastDiscussed: Date}> = [];
    
    for (const word of queryWords) {
      const relevantMessages = messages.filter(msg => 
        msg.content.toLowerCase().includes(word)
      );
      
      if (relevantMessages.length > 0) {
        const participants = Array.from(new Set(relevantMessages.map(msg => msg.userId)));
        const lastMessage = relevantMessages[relevantMessages.length - 1];
        
        topicInsights.push({
          topic: word,
          participants: participants.map(id => `User ${id}`), // Could enhance with actual names
          lastDiscussed: new Date(lastMessage.timestamp)
        });
      }
    }
    
    return topicInsights;
  }

  private findEntityConnections(relevantEntities: any[], relationships: any[], allEntities: any[]): Array<{entity1: string, entity2: string, connectionType: string}> {
    const connections: Array<{entity1: string, entity2: string, connectionType: string}> = [];
    
    for (const entity of relevantEntities) {
      const entityObj = allEntities.find(e => e.name === entity.name);
      if (!entityObj) continue;
      
      const entityRelationships = relationships.filter(r => 
        r.fromEntityId === entityObj.id || r.toEntityId === entityObj.id
      );
      
      for (const rel of entityRelationships) {
        const connectedEntityId = rel.fromEntityId === entityObj.id ? rel.toEntityId : rel.fromEntityId;
        const connectedEntity = allEntities.find(e => e.id === connectedEntityId);
        
        if (connectedEntity) {
          connections.push({
            entity1: entity.name,
            entity2: connectedEntity.name,
            connectionType: rel.relationshipType
          });
        }
      }
    }
    
    return connections;
  }

  private getEntityContext(entity: any, messages: any[], relationships: any[]): string {
    // Find messages that mention this entity (exclude AI responses and current queries)
    const relevantMessages = messages.filter(msg => 
      msg.content.toLowerCase().includes(entity.name.toLowerCase()) &&
      !msg.isAiResponse && 
      !msg.content.includes('@aiagent') // Exclude queries to AI
    );
    
    if (relevantMessages.length === 0) return 'No previous mentions found';
    
    // Get the most informative messages (longer content, actual conversations)
    const informativeMessages = relevantMessages
      .filter(msg => msg.content.length > 20)
      .sort((a, b) => b.content.length - a.content.length)
      .slice(0, 2); // Get top 2 most informative messages
    
    if (informativeMessages.length === 0) {
      return `${relevantMessages.length} brief mentions found`;
    }
    
    const contexts = informativeMessages.map(msg => {
      const preview = msg.content.length > 120 
        ? msg.content.substring(0, 120) + "..." 
        : msg.content;
      return `"${preview}"`;
    });
    
    return `Found in conversations: ${contexts.join(' | ')} (${relevantMessages.length} total mentions)`;
  }

  private getConnectionCount(entityId: number, relationships: KnowledgeGraphRelationship[]): number {
    return relationships.filter(rel => 
      rel.fromEntityId === entityId || rel.toEntityId === entityId
    ).length;
  }

  private async generateEntitySummaries(entities: KnowledgeGraphEntity[], relationships: KnowledgeGraphRelationship[]): Promise<EntitySummary[]> {
    const summaries: EntitySummary[] = [];
    
    for (const entity of entities) {
      const entityRelationships = relationships.filter(rel => 
        rel.fromEntityId === entity.id || rel.toEntityId === entity.id
      );
      
      const relatedEntityIds = entityRelationships.map(rel => 
        rel.fromEntityId === entity.id ? rel.toEntityId : rel.fromEntityId
      ).filter((id): id is number => id !== null);
      
      const relatedEntityNames = entities
        .filter(e => relatedEntityIds.includes(e.id))
        .map(e => e.name);
      
      summaries.push({
        name: entity.name,
        type: entity.type,
        mentions: 1, // Could be enhanced with actual mention counts
        relatedEntities: relatedEntityNames,
        lastMentioned: new Date() // Could be enhanced with actual timestamp
      });
    }
    
    return summaries.sort((a, b) => b.mentions - a.mentions);
  }

  // NEW: Stub methods for routes.ts compatibility
  async createOrUpdateConversationThread(messages: any[], topic: string): Promise<void> {
    // This functionality is handled by the storage layer
    console.log('📝 Creating/updating conversation thread for topic:', topic);
  }
}

export const knowledgeGraphService = new KnowledgeGraphService();