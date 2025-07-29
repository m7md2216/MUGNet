import { pgTable, text, serial, integer, boolean, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("chat_users", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  initials: text("initials").notNull(),
  color: text("color").notNull(),
  isActive: boolean("is_active").default(true),
  lastActiveAt: timestamp("last_active_at").defaultNow(),
});

export const messages = pgTable("messages", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id),
  content: text("content").notNull(),
  mentions: text("mentions").array().default([]),
  timestamp: timestamp("timestamp").defaultNow(),
  isAiResponse: boolean("is_ai_response").default(false),
});

export const knowledgeGraphEntities = pgTable("knowledge_graph_entities", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  type: text("type").notNull(), // 'person', 'topic', 'event', 'date'
  properties: jsonb("properties").default({}),
  createdAt: timestamp("created_at").defaultNow(),
});

export const knowledgeGraphRelationships = pgTable("knowledge_graph_relationships", {
  id: serial("id").primaryKey(),
  fromEntityId: integer("from_entity_id").references(() => knowledgeGraphEntities.id),
  toEntityId: integer("to_entity_id").references(() => knowledgeGraphEntities.id),
  relationshipType: text("relationship_type").notNull(),
  properties: jsonb("properties").default({}),
  messageId: integer("message_id").references(() => messages.id),
  createdAt: timestamp("created_at").defaultNow(),
});

export const conversationThreads = pgTable("conversation_threads", {
  id: serial("id").primaryKey(),
  topic: text("topic").notNull(),
  participants: text("participants").array().default([]),
  messageIds: integer("message_ids").array().default([]),
  lastMessageAt: timestamp("last_message_at").defaultNow(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  name: true,
  initials: true,
  color: true,
});

export const insertMessageSchema = createInsertSchema(messages).pick({
  userId: true,
  content: true,
  mentions: true,
  isAiResponse: true,
});

export const insertKnowledgeGraphEntitySchema = createInsertSchema(knowledgeGraphEntities).pick({
  name: true,
  type: true,
  properties: true,
});

export const insertKnowledgeGraphRelationshipSchema = createInsertSchema(knowledgeGraphRelationships).pick({
  fromEntityId: true,
  toEntityId: true,
  relationshipType: true,
  properties: true,
  messageId: true,
});

export const insertConversationThreadSchema = createInsertSchema(conversationThreads).pick({
  topic: true,
  participants: true,
  messageIds: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export type InsertMessage = z.infer<typeof insertMessageSchema>;
export type Message = typeof messages.$inferSelect;

export type InsertKnowledgeGraphEntity = z.infer<typeof insertKnowledgeGraphEntitySchema>;
export type KnowledgeGraphEntity = typeof knowledgeGraphEntities.$inferSelect;

export type InsertKnowledgeGraphRelationship = z.infer<typeof insertKnowledgeGraphRelationshipSchema>;
export type KnowledgeGraphRelationship = typeof knowledgeGraphRelationships.$inferSelect;

export type InsertConversationThread = z.infer<typeof insertConversationThreadSchema>;
export type ConversationThread = typeof conversationThreads.$inferSelect;
