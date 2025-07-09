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
      participants: thread.participants,
      messageCount: thread.messageIds.length,
      lastMessageAt: thread.lastMessageAt!
    }));

    // Create entity summaries
    const entitySummaries: EntitySummary[] = await this.getEntitySummaries(entities, relationships);

    return {
      nodes,
      relationships: graphRelationships,
      conversationThreads,
      entitySummaries
    };
  }

  private getConnectionCount(entityId: number, relationships: KnowledgeGraphRelationship[]): number {
    return relationships.filter(rel => 
      rel.fromEntityId === entityId || rel.toEntityId === entityId
    ).length;
  }

  private async getEntitySummaries(
    entities: KnowledgeGraphEntity[], 
    relationships: KnowledgeGraphRelationship[]
  ): Promise<EntitySummary[]> {
    const summaries: EntitySummary[] = [];
    
    for (const entity of entities) {
      const relatedRelationships = relationships.filter(rel => 
        rel.fromEntityId === entity.id || rel.toEntityId === entity.id
      );
      
      const relatedEntities = relatedRelationships.map(rel => {
        const relatedEntityId = rel.fromEntityId === entity.id ? rel.toEntityId : rel.fromEntityId;
        const relatedEntity = entities.find(e => e.id === relatedEntityId);
        return relatedEntity?.name || '';
      }).filter(name => name !== '');

      summaries.push({
        name: entity.name,
        type: entity.type,
        mentions: relatedRelationships.length,
        relatedEntities: [...new Set(relatedEntities)],
        lastMentioned: entity.createdAt!
      });
    }

    return summaries.sort((a, b) => b.mentions - a.mentions);
  }

  async findConnectedEntities(entityName: string, depth: number = 2): Promise<GraphNode[]> {
    const startEntity = await storage.getKnowledgeGraphEntityByName(entityName);
    if (!startEntity) return [];

    const visited = new Set<number>();
    const result: GraphNode[] = [];
    const queue: { entity: KnowledgeGraphEntity; currentDepth: number }[] = [
      { entity: startEntity, currentDepth: 0 }
    ];

    while (queue.length > 0) {
      const { entity, currentDepth } = queue.shift()!;
      
      if (visited.has(entity.id) || currentDepth > depth) continue;
      
      visited.add(entity.id);
      
      const relationships = await storage.getKnowledgeGraphRelationshipsByEntity(entity.id);
      
      result.push({
        id: entity.id,
        name: entity.name,
        type: entity.type,
        properties: entity.properties,
        connections: relationships.length
      });

      if (currentDepth < depth) {
        for (const rel of relationships) {
          const nextEntityId = rel.fromEntityId === entity.id ? rel.toEntityId : rel.fromEntityId;
          const nextEntity = await storage.getKnowledgeGraphEntity(nextEntityId!);
          
          if (nextEntity && !visited.has(nextEntity.id)) {
            queue.push({ entity: nextEntity, currentDepth: currentDepth + 1 });
          }
        }
      }
    }

    return result;
  }

  async createOrUpdateConversationThread(
    topic: string,
    participants: string[],
    messageId: number
  ): Promise<void> {
    const existingThreads = await storage.getConversationThreadsByParticipant(participants[0]);
    
    let thread = existingThreads.find(t => 
      t.topic === topic || 
      t.participants.every(p => participants.includes(p))
    );

    if (thread) {
      await storage.updateConversationThread(thread.id, messageId);
    } else {
      await storage.createConversationThread({
        topic,
        participants,
        messageIds: [messageId]
      });
    }
  }

  async getContextForUser(userName: string): Promise<{
    userEntity: KnowledgeGraphEntity | null;
    relatedEntities: KnowledgeGraphEntity[];
    recentConversations: Message[];
  }> {
    const userEntity = await storage.getKnowledgeGraphEntityByName(userName);
    
    let relatedEntities: KnowledgeGraphEntity[] = [];
    if (userEntity) {
      const connectedNodes = await this.findConnectedEntities(userName, 1);
      relatedEntities = await Promise.all(
        connectedNodes.map(node => storage.getKnowledgeGraphEntity(node.id))
      ).then(entities => entities.filter(e => e !== undefined) as KnowledgeGraphEntity[]);
    }

    const recentConversations = await storage.getMessagesByMention(userName.toLowerCase());
    
    return {
      userEntity,
      relatedEntities,
      recentConversations: recentConversations.slice(-10)
    };
  }
}

export const knowledgeGraphService = new KnowledgeGraphService();
