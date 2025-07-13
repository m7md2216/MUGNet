import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { generateAIResponse, extractAndStoreEntities } from "./services/openai";
import { knowledgeGraphService } from "./services/knowledgeGraph";
import { insertUserSchema, insertMessageSchema } from "@shared/schema";
import { z } from "zod";

// Helper functions for basic entity extraction
function extractTopics(text: string): string[] {
  // Basic topic extraction - look for common nouns/activities
  const topics = [];
  const topicKeywords = ['hiking', 'beach', 'restaurant', 'cuisine', 'food', 'travel', 'brewery', 'italian', 'cooking', 'music', 'sports', 'work', 'vacation', 'shopping', 'pennsylvania', 'newark', 'delaware'];
  
  for (const keyword of topicKeywords) {
    if (text.toLowerCase().includes(keyword)) {
      topics.push(keyword);
    }
  }
  
  return topics;
}

function extractEvents(text: string): string[] {
  // Basic event extraction - look for past/future actions
  const events = [];
  const eventPatterns = [
    /went (to|hiking|swimming|shopping|running)/gi,
    /visited (.*?)(?:\s|$)/gi,
    /went to (.*?)(?:\s|$)/gi,
    /ate at (.*?)(?:\s|$)/gi,
    /saw (.*?)(?:\s|$)/gi
  ];
  
  for (const pattern of eventPatterns) {
    const matches = text.match(pattern);
    if (matches) {
      events.push(...matches);
    }
  }
  
  return events;
}

function extractDates(text: string): string[] {
  // Basic date extraction - look for time references
  const dates = [];
  const datePatterns = [
    /today/gi,
    /yesterday/gi,
    /tomorrow/gi,
    /the other day/gi,
    /last week/gi,
    /next week/gi,
    /this week/gi,
    /the day after/gi,
    /last month/gi,
    /next month/gi
  ];
  
  for (const pattern of datePatterns) {
    const matches = text.match(pattern);
    if (matches) {
      dates.push(...matches.map(m => m.toLowerCase()));
    }
  }
  
  return dates;
}

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

      console.log('=== AI MENTION DEBUG ===');
      console.log('Message content:', messageData.content);
      console.log('Message mentions:', messageData.mentions);
      console.log('AI Mentions found:', aiMentions);
      console.log('Will trigger AI?:', aiMentions.length > 0);

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

  // Process all existing messages to populate knowledge graph
  app.post("/api/process-messages", async (req, res) => {
    try {
      const messages = await storage.getAllMessages();
      const users = await storage.getAllUsers();
      const userMap = new Map(users.map(u => [u.id, u]));
      
      for (const message of messages) {
        const user = userMap.get(message.userId);
        if (!user) continue;
        
        // Extract entities from each message
        const fakeAiResponse = {
          response: message.content,
          extractedEntities: {
            people: message.mentions || [],
            topics: extractTopics(message.content),
            events: extractEvents(message.content),
            dates: extractDates(message.content)
          },
          relevantContext: []
        };
        
        await extractAndStoreEntities(
          message.id,
          fakeAiResponse.extractedEntities,
          [user.name, ...(message.mentions || [])]
        );
      }
      
      res.json({ message: "All messages processed successfully", processedCount: messages.length });
    } catch (error) {
      console.error("Process messages error:", error);
      res.status(500).json({ message: "Failed to process messages", error: error.message });
    }
  });

  // Generate example conversations
  app.post("/api/generate-examples", async (req, res) => {
    try {
      const users = await storage.getAllUsers();
      const regularUsers = users.filter(u => u.name !== "AI Agent");
      
      if (regularUsers.length < 2) {
        return res.status(400).json({ 
          message: "At least 2 non-AI users are required to generate examples" 
        });
      }

      // Generate realistic conversation examples using OpenAI
      const { generateExampleConversations } = await import("./services/exampleGenerator");
      const exampleMessages = await generateExampleConversations(regularUsers);
      
      // Insert the generated messages into the database
      const createdMessages = [];
      for (const msg of exampleMessages) {
        const message = await storage.createMessage(msg);
        createdMessages.push(message);
      }
      
      res.json({ 
        message: "Example conversations generated successfully",
        messagesCreated: createdMessages.length,
        examples: createdMessages
      });
    } catch (error) {
      console.error("Generate examples error:", error);
      res.status(500).json({ message: "Failed to generate examples", error: error.message });
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
