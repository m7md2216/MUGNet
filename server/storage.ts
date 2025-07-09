import { 
  users, 
  messages, 
  knowledgeGraphEntities, 
  knowledgeGraphRelationships, 
  conversationThreads,
  type User, 
  type InsertUser,
  type Message,
  type InsertMessage,
  type KnowledgeGraphEntity,
  type InsertKnowledgeGraphEntity,
  type KnowledgeGraphRelationship,
  type InsertKnowledgeGraphRelationship,
  type ConversationThread,
  type InsertConversationThread
} from "@shared/schema";
import { db } from "./db";
import { eq, desc } from "drizzle-orm";
import { neo4jService } from "./services/neo4j";

export interface IStorage {
  // User management
  getUser(id: number): Promise<User | undefined>;
  getUserByName(name: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  getAllUsers(): Promise<User[]>;
  updateUserActivity(id: number): Promise<void>;

  // Message management
  getMessage(id: number): Promise<Message | undefined>;
  createMessage(message: InsertMessage): Promise<Message>;
  getAllMessages(): Promise<Message[]>;
  getMessagesByUser(userId: number): Promise<Message[]>;
  getMessagesByMention(mention: string): Promise<Message[]>;
  deleteAllMessages(): Promise<void>;

  // Knowledge graph entities
  getKnowledgeGraphEntity(id: number): Promise<KnowledgeGraphEntity | undefined>;
  getKnowledgeGraphEntityByName(name: string): Promise<KnowledgeGraphEntity | undefined>;
  createKnowledgeGraphEntity(entity: InsertKnowledgeGraphEntity): Promise<KnowledgeGraphEntity>;
  getAllKnowledgeGraphEntities(): Promise<KnowledgeGraphEntity[]>;
  getKnowledgeGraphEntitiesByType(type: string): Promise<KnowledgeGraphEntity[]>;

  // Knowledge graph relationships
  getKnowledgeGraphRelationship(id: number): Promise<KnowledgeGraphRelationship | undefined>;
  createKnowledgeGraphRelationship(relationship: InsertKnowledgeGraphRelationship): Promise<KnowledgeGraphRelationship>;
  getKnowledgeGraphRelationshipsByEntity(entityId: number): Promise<KnowledgeGraphRelationship[]>;
  getAllKnowledgeGraphRelationships(): Promise<KnowledgeGraphRelationship[]>;

  // Conversation threads
  getConversationThread(id: number): Promise<ConversationThread | undefined>;
  createConversationThread(thread: InsertConversationThread): Promise<ConversationThread>;
  getAllConversationThreads(): Promise<ConversationThread[]>;
  getConversationThreadsByParticipant(participant: string): Promise<ConversationThread[]>;
  updateConversationThread(id: number, messageId: number): Promise<void>;
}

export class MemStorage implements IStorage {
  private users: Map<number, User> = new Map();
  private messages: Map<number, Message> = new Map();
  private knowledgeGraphEntities: Map<number, KnowledgeGraphEntity> = new Map();
  private knowledgeGraphRelationships: Map<number, KnowledgeGraphRelationship> = new Map();
  private conversationThreads: Map<number, ConversationThread> = new Map();
  
  private currentUserId = 1;
  private currentMessageId = 1;
  private currentEntityId = 1;
  private currentRelationshipId = 1;
  private currentThreadId = 1;

  constructor() {
    // Initialize with AI agent
    this.createUser({
      name: "AI Agent",
      initials: "AI",
      color: "emerald"
    });
  }

  // User management
  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByName(name: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(user => user.name === name);
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = this.currentUserId++;
    const user: User = {
      ...insertUser,
      id,
      isActive: true,
      lastActiveAt: new Date()
    };
    this.users.set(id, user);
    return user;
  }

  async getAllUsers(): Promise<User[]> {
    return Array.from(this.users.values());
  }

  async updateUserActivity(id: number): Promise<void> {
    const user = this.users.get(id);
    if (user) {
      user.lastActiveAt = new Date();
      this.users.set(id, user);
    }
  }

  // Message management
  async getMessage(id: number): Promise<Message | undefined> {
    return this.messages.get(id);
  }

  async createMessage(insertMessage: InsertMessage): Promise<Message> {
    const id = this.currentMessageId++;
    const message: Message = {
      id,
      userId: insertMessage.userId || null,
      content: insertMessage.content,
      mentions: insertMessage.mentions || [],
      timestamp: new Date(),
      isAiResponse: false
    };
    this.messages.set(id, message);
    return message;
  }

  async getAllMessages(): Promise<Message[]> {
    return Array.from(this.messages.values()).sort((a, b) => 
      (a.timestamp?.getTime() || 0) - (b.timestamp?.getTime() || 0)
    );
  }

  async getMessagesByUser(userId: number): Promise<Message[]> {
    return Array.from(this.messages.values()).filter(msg => msg.userId === userId);
  }

  async getMessagesByMention(mention: string): Promise<Message[]> {
    return Array.from(this.messages.values()).filter(msg => 
      msg.mentions?.includes(mention) || false
    );
  }

  async deleteAllMessages(): Promise<void> {
    this.messages.clear();
    this.knowledgeGraphEntities.clear();
    this.knowledgeGraphRelationships.clear();
    this.conversationThreads.clear();
    this.currentMessageId = 1;
    this.currentEntityId = 1;
    this.currentRelationshipId = 1;
    this.currentThreadId = 1;
  }

  // Knowledge graph entities
  async getKnowledgeGraphEntity(id: number): Promise<KnowledgeGraphEntity | undefined> {
    return this.knowledgeGraphEntities.get(id);
  }

  async getKnowledgeGraphEntityByName(name: string): Promise<KnowledgeGraphEntity | undefined> {
    return Array.from(this.knowledgeGraphEntities.values()).find(entity => entity.name === name);
  }

  async createKnowledgeGraphEntity(insertEntity: InsertKnowledgeGraphEntity): Promise<KnowledgeGraphEntity> {
    const id = this.currentEntityId++;
    const entity: KnowledgeGraphEntity = {
      id,
      name: insertEntity.name,
      type: insertEntity.type,
      properties: insertEntity.properties || {},
      createdAt: new Date()
    };
    this.knowledgeGraphEntities.set(id, entity);
    return entity;
  }

  async getAllKnowledgeGraphEntities(): Promise<KnowledgeGraphEntity[]> {
    return Array.from(this.knowledgeGraphEntities.values());
  }

  async getKnowledgeGraphEntitiesByType(type: string): Promise<KnowledgeGraphEntity[]> {
    return Array.from(this.knowledgeGraphEntities.values()).filter(entity => entity.type === type);
  }

  // Knowledge graph relationships
  async getKnowledgeGraphRelationship(id: number): Promise<KnowledgeGraphRelationship | undefined> {
    return this.knowledgeGraphRelationships.get(id);
  }

  async createKnowledgeGraphRelationship(insertRelationship: InsertKnowledgeGraphRelationship): Promise<KnowledgeGraphRelationship> {
    const id = this.currentRelationshipId++;
    const relationship: KnowledgeGraphRelationship = {
      id,
      fromEntityId: insertRelationship.fromEntityId || null,
      toEntityId: insertRelationship.toEntityId || null,
      relationshipType: insertRelationship.relationshipType,
      properties: insertRelationship.properties || {},
      messageId: insertRelationship.messageId || null,
      createdAt: new Date()
    };
    this.knowledgeGraphRelationships.set(id, relationship);
    return relationship;
  }

  async getKnowledgeGraphRelationshipsByEntity(entityId: number): Promise<KnowledgeGraphRelationship[]> {
    return Array.from(this.knowledgeGraphRelationships.values()).filter(rel => 
      rel.fromEntityId === entityId || rel.toEntityId === entityId
    );
  }

  async getAllKnowledgeGraphRelationships(): Promise<KnowledgeGraphRelationship[]> {
    return Array.from(this.knowledgeGraphRelationships.values());
  }

  // Conversation threads
  async getConversationThread(id: number): Promise<ConversationThread | undefined> {
    return this.conversationThreads.get(id);
  }

  async createConversationThread(insertThread: InsertConversationThread): Promise<ConversationThread> {
    const id = this.currentThreadId++;
    const thread: ConversationThread = {
      id,
      topic: insertThread.topic,
      participants: insertThread.participants || [],
      messageIds: insertThread.messageIds || [],
      lastMessageAt: new Date()
    };
    this.conversationThreads.set(id, thread);
    return thread;
  }

  async getAllConversationThreads(): Promise<ConversationThread[]> {
    return Array.from(this.conversationThreads.values());
  }

  async getConversationThreadsByParticipant(participant: string): Promise<ConversationThread[]> {
    return Array.from(this.conversationThreads.values()).filter(thread => 
      thread.participants?.includes(participant) || false
    );
  }

  async updateConversationThread(id: number, messageId: number): Promise<void> {
    const thread = this.conversationThreads.get(id);
    if (thread) {
      if (!thread.messageIds) {
        thread.messageIds = [];
      }
      thread.messageIds.push(messageId);
      thread.lastMessageAt = new Date();
      this.conversationThreads.set(id, thread);
    }
  }
}

export class DatabaseStorage implements IStorage {
  constructor() {
    // Initialize with AI agent if not exists
    this.initializeAIAgent();
    this.initializeNeo4j();
  }

  private async initializeAIAgent() {
    const aiAgent = await this.getUserByName("AI Agent");
    if (!aiAgent) {
      await this.createUser({
        name: "AI Agent",
        initials: "AI",
        color: "emerald"
      });
    }
  }

  private async initializeNeo4j() {
    try {
      await neo4jService.connect();
    } catch (error) {
      console.warn('Neo4j initialization failed, continuing without graph features:', error);
    }
  }

  // User management
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByName(name: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.name, name));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values({
        ...insertUser,
        isActive: true,
        lastActiveAt: new Date()
      })
      .returning();
    return user;
  }

  async getAllUsers(): Promise<User[]> {
    return await db.select().from(users).orderBy(desc(users.lastActiveAt));
  }

  async updateUserActivity(id: number): Promise<void> {
    await db.update(users)
      .set({ lastActiveAt: new Date() })
      .where(eq(users.id, id));
  }

  // Message management
  async getMessage(id: number): Promise<Message | undefined> {
    const [message] = await db.select().from(messages).where(eq(messages.id, id));
    return message || undefined;
  }

  async createMessage(insertMessage: InsertMessage): Promise<Message> {
    const [message] = await db
      .insert(messages)
      .values({
        ...insertMessage,
        timestamp: new Date(),
        isAiResponse: false
      })
      .returning();
    
    // Sync with Neo4j
    try {
      const sender = await this.getUser(message.userId || 0);
      if (sender) {
        await neo4jService.syncUser(sender);
        
        // Get recipients for mentions
        const recipients = await Promise.all(
          (message.mentions || []).map(async (mention) => {
            const user = await this.getUserByName(mention);
            return user;
          })
        );
        
        const validRecipients = recipients.filter(user => user !== undefined) as User[];
        
        // Extract topics from message content
        const topics = this.extractTopics(message.content);
        
        await neo4jService.syncMessage({
          message,
          sender,
          recipients: validRecipients,
          topics,
          timestamp: message.timestamp || new Date()
        });
      }
    } catch (error) {
      console.error('Neo4j sync failed:', error);
    }
    
    return message;
  }

  private extractTopics(text: string): string[] {
    const topics: string[] = [];
    const lowerText = text.toLowerCase();
    
    // Extract hashtags
    const hashtags = text.match(/#(\w+)/g);
    if (hashtags) {
      topics.push(...hashtags.map(tag => tag.slice(1)));
    }
    
    // Extract common topic keywords
    const topicKeywords = [
      'project', 'meeting', 'deadline', 'task', 'bug', 'feature',
      'review', 'testing', 'deployment', 'design', 'planning',
      'discussion', 'question', 'problem', 'solution', 'update'
    ];
    
    topicKeywords.forEach(keyword => {
      if (lowerText.includes(keyword)) {
        topics.push(keyword);
      }
    });
    
    return [...new Set(topics)]; // Remove duplicates
  }

  async getAllMessages(): Promise<Message[]> {
    return await db.select().from(messages).orderBy(messages.timestamp);
  }

  async getMessagesByUser(userId: number): Promise<Message[]> {
    return await db.select().from(messages).where(eq(messages.userId, userId));
  }

  async getMessagesByMention(mention: string): Promise<Message[]> {
    return await db.select().from(messages).where(eq(messages.mentions, [mention]));
  }

  async deleteAllMessages(): Promise<void> {
    // Delete in order due to foreign key constraints
    await db.delete(knowledgeGraphRelationships);
    await db.delete(knowledgeGraphEntities);
    await db.delete(conversationThreads);
    await db.delete(messages);
  }

  // Knowledge graph entities
  async getKnowledgeGraphEntity(id: number): Promise<KnowledgeGraphEntity | undefined> {
    const [entity] = await db.select().from(knowledgeGraphEntities).where(eq(knowledgeGraphEntities.id, id));
    return entity || undefined;
  }

  async getKnowledgeGraphEntityByName(name: string): Promise<KnowledgeGraphEntity | undefined> {
    const [entity] = await db.select().from(knowledgeGraphEntities).where(eq(knowledgeGraphEntities.name, name));
    return entity || undefined;
  }

  async createKnowledgeGraphEntity(insertEntity: InsertKnowledgeGraphEntity): Promise<KnowledgeGraphEntity> {
    const [entity] = await db
      .insert(knowledgeGraphEntities)
      .values({
        ...insertEntity,
        properties: insertEntity.properties || {},
        createdAt: new Date()
      })
      .returning();
    return entity;
  }

  async getAllKnowledgeGraphEntities(): Promise<KnowledgeGraphEntity[]> {
    return await db.select().from(knowledgeGraphEntities).orderBy(desc(knowledgeGraphEntities.createdAt));
  }

  async getKnowledgeGraphEntitiesByType(type: string): Promise<KnowledgeGraphEntity[]> {
    return await db.select().from(knowledgeGraphEntities).where(eq(knowledgeGraphEntities.type, type));
  }

  // Knowledge graph relationships
  async getKnowledgeGraphRelationship(id: number): Promise<KnowledgeGraphRelationship | undefined> {
    const [relationship] = await db.select().from(knowledgeGraphRelationships).where(eq(knowledgeGraphRelationships.id, id));
    return relationship || undefined;
  }

  async createKnowledgeGraphRelationship(insertRelationship: InsertKnowledgeGraphRelationship): Promise<KnowledgeGraphRelationship> {
    const [relationship] = await db
      .insert(knowledgeGraphRelationships)
      .values({
        ...insertRelationship,
        properties: insertRelationship.properties || {},
        createdAt: new Date()
      })
      .returning();
    return relationship;
  }

  async getKnowledgeGraphRelationshipsByEntity(entityId: number): Promise<KnowledgeGraphRelationship[]> {
    return await db.select().from(knowledgeGraphRelationships).where(
      eq(knowledgeGraphRelationships.fromEntityId, entityId)
    );
  }

  async getAllKnowledgeGraphRelationships(): Promise<KnowledgeGraphRelationship[]> {
    return await db.select().from(knowledgeGraphRelationships).orderBy(desc(knowledgeGraphRelationships.createdAt));
  }

  // Conversation threads
  async getConversationThread(id: number): Promise<ConversationThread | undefined> {
    const [thread] = await db.select().from(conversationThreads).where(eq(conversationThreads.id, id));
    return thread || undefined;
  }

  async createConversationThread(insertThread: InsertConversationThread): Promise<ConversationThread> {
    const [thread] = await db
      .insert(conversationThreads)
      .values({
        ...insertThread,
        participants: insertThread.participants || [],
        messageIds: insertThread.messageIds || [],
        lastMessageAt: new Date()
      })
      .returning();
    return thread;
  }

  async getAllConversationThreads(): Promise<ConversationThread[]> {
    return await db.select().from(conversationThreads).orderBy(desc(conversationThreads.lastMessageAt));
  }

  async getConversationThreadsByParticipant(participant: string): Promise<ConversationThread[]> {
    return await db.select().from(conversationThreads).where(
      eq(conversationThreads.participants, [participant])
    );
  }

  async updateConversationThread(id: number, messageId: number): Promise<void> {
    const thread = await this.getConversationThread(id);
    if (thread) {
      const updatedMessageIds = [...(thread.messageIds || []), messageId];
      await db.update(conversationThreads)
        .set({ 
          messageIds: updatedMessageIds,
          lastMessageAt: new Date()
        })
        .where(eq(conversationThreads.id, id));
    }
  }
}

export const storage = new DatabaseStorage();
