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

export const storage = new MemStorage();
