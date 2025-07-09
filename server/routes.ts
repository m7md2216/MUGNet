import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { generateAIResponse, extractAndStoreEntities } from "./services/openai";
import { knowledgeGraphService } from "./services/knowledgeGraph";
import { insertUserSchema, insertMessageSchema } from "@shared/schema";
import { z } from "zod";

export async function registerRoutes(app: Express): Promise<Server> {
  // User management routes
  app.get("/api/users", async (req, res) => {
    try {
      const users = await storage.getAllUsers();
      res.json(users);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });

  app.post("/api/users", async (req, res) => {
    try {
      const userData = insertUserSchema.parse(req.body);
      const user = await storage.createUser(userData);
      res.json(user);
    } catch (error) {
      res.status(400).json({ message: "Invalid user data" });
    }
  });

  app.put("/api/users/:id/activity", async (req, res) => {
    try {
      const userId = parseInt(req.params.id);
      await storage.updateUserActivity(userId);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: "Failed to update user activity" });
    }
  });

  // Message routes
  app.get("/api/messages", async (req, res) => {
    try {
      const messages = await storage.getAllMessages();
      res.json(messages);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch messages" });
    }
  });

  app.post("/api/messages", async (req, res) => {
    try {
      const messageData = insertMessageSchema.parse(req.body);
      const message = await storage.createMessage(messageData);
      
      // Update user activity
      if (messageData.userId) {
        await storage.updateUserActivity(messageData.userId);
      }

      // Check if AI agent is mentioned
      const aiMentions = (messageData.mentions || []).filter(mention => 
        mention.toLowerCase().includes('agent') || mention.toLowerCase().includes('ai')
      );

      console.log('AI Mention Check:', {
        mentions: messageData.mentions,
        aiMentions,
        willTriggerAI: aiMentions.length > 0
      });

      if (aiMentions.length > 0) {
        // Generate AI response
        const user = await storage.getUser(messageData.userId!);
        const conversationHistory = await storage.getAllMessages();
        
        if (user) {
          try {
            const aiResponse = await generateAIResponse(
              messageData.mentions || [],
              messageData.content,
              user,
              conversationHistory
            );

            // Create AI response message
            const aiUser = await storage.getUserByName("AI Agent");
            if (aiUser) {
              const aiMessage = await storage.createMessage({
                userId: aiUser.id,
                content: aiResponse.response,
                mentions: messageData.mentions || []
              });

              // Update message to mark as AI response
              aiMessage.isAiResponse = true;

              // Extract and store entities from both user message and AI response
              await extractAndStoreEntities(
                message.id,
                aiResponse.extractedEntities,
                [user.name, ...(messageData.mentions || [])]
              );
              
              await extractAndStoreEntities(
                aiMessage.id,
                aiResponse.extractedEntities,
                [user.name, "AI Agent", ...(messageData.mentions || [])]
              );

              // Create or update conversation thread
              await knowledgeGraphService.createOrUpdateConversationThread(
                "AI Conversation",
                [user.name, "AI Agent"],
                aiMessage.id
              );

              res.json({ message, aiResponse: aiMessage });
            } else {
              res.json({ message });
            }
          } catch (aiError) {
            console.error("AI Response Error:", aiError);
            console.error("AI Error Details:", {
              message: (aiError as any).message,
              stack: (aiError as any).stack,
              type: (aiError as any).constructor?.name
            });
            res.json({ message, error: "Failed to generate AI response" });
          }
        } else {
          res.json({ message });
        }
      } else {
        res.json({ message });
      }
    } catch (error) {
      res.status(400).json({ message: "Invalid message data" });
    }
  });

  // Clear all messages
  app.delete("/api/messages", async (req, res) => {
    try {
      await storage.deleteAllMessages();
      res.json({ message: "All messages deleted successfully" });
    } catch (error) {
      console.error("Delete messages error:", error);
      res.status(500).json({ message: "Failed to delete messages", error: error.message });
    }
  });

  // Knowledge graph routes
  app.get("/api/knowledge-graph", async (req, res) => {
    try {
      const graphData = await knowledgeGraphService.getGraphData();
      res.json(graphData);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch knowledge graph data" });
    }
  });

  app.get("/api/knowledge-graph/entities/:type", async (req, res) => {
    try {
      const type = req.params.type;
      const entities = await storage.getKnowledgeGraphEntitiesByType(type);
      res.json(entities);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch entities" });
    }
  });

  app.get("/api/knowledge-graph/context/:username", async (req, res) => {
    try {
      const username = req.params.username;
      const context = await knowledgeGraphService.getContextForUser(username);
      res.json(context);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch user context" });
    }
  });

  app.get("/api/knowledge-graph/connections/:entityName", async (req, res) => {
    try {
      const entityName = req.params.entityName;
      const depth = parseInt(req.query.depth as string) || 2;
      const connections = await knowledgeGraphService.findConnectedEntities(entityName, depth);
      res.json(connections);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch entity connections" });
    }
  });

  // Conversation threads
  app.get("/api/conversation-threads", async (req, res) => {
    try {
      const threads = await storage.getAllConversationThreads();
      res.json(threads);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch conversation threads" });
    }
  });

  app.get("/api/conversation-threads/:participant", async (req, res) => {
    try {
      const participant = req.params.participant;
      const threads = await storage.getConversationThreadsByParticipant(participant);
      res.json(threads);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch participant threads" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
