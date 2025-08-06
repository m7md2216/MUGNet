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

// PostgreSQL knowledge graph tables removed - using Neo4j as single source of truth

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

// PostgreSQL knowledge graph schemas removed - using Neo4j as single source of truth

export const insertConversationThreadSchema = createInsertSchema(conversationThreads).pick({
  topic: true,
  participants: true,
  messageIds: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export type InsertMessage = z.infer<typeof insertMessageSchema>;
export type Message = typeof messages.$inferSelect;

// PostgreSQL knowledge graph types removed - using Neo4j as single source of truth

export type InsertConversationThread = z.infer<typeof insertConversationThreadSchema>;
export type ConversationThread = typeof conversationThreads.$inferSelect;
