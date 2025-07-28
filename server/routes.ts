import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { simpleAIService } from "./services/simpleAI";
import { knowledgeGraphService } from "./services/knowledgeGraph";
import { relationshipInferenceService } from "./services/relationshipInference";
import { neo4jService } from "./services/neo4j";
import { insertUserSchema, insertMessageSchema } from "@shared/schema";
import { z } from "zod";

// Note: Entity extraction is now handled by the Neo4j service automatically

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

      // Extract mentions from content if not provided
      let mentions = messageData.mentions || [];
      if (mentions.length === 0) {
        const mentionMatches = messageData.content.match(/@(\w+)/g);
        if (mentionMatches) {
          mentions = mentionMatches.map(match => match.replace('@', ''));
        }
      }

      // Check if AI agent is mentioned
      const aiMentions = mentions.filter(mention => 
        mention.toLowerCase().includes('agent') || mention.toLowerCase().includes('ai')
      );

      console.log('=== AI MENTION DEBUG ===');
      console.log('Message content:', messageData.content);
      console.log('Message mentions:', messageData.mentions);
      console.log('AI Mentions found:', aiMentions);
      console.log('Will trigger AI?:', aiMentions.length > 0);

      // Process relationship inference for mentions
      try {
        await relationshipInferenceService.processMessage(message);
      } catch (relationshipError) {
        console.warn('Relationship inference failed:', relationshipError);
      }

      // Extract entities and update knowledge graph for ALL messages
      const user = await storage.getUser(messageData.userId!);
      if (user) {
        try {
          console.log('🚀 Starting entity extraction for message:', message.id, message.content);
          await neo4jService.extractAndStoreEntities(
            message.content,
            message.id.toString()
          );
          console.log('✅ Entity extraction completed for message:', message.id);
        } catch (entityError) {
          console.warn('❌ Entity extraction failed:', entityError);
        }
      }

      if (aiMentions.length > 0) {
        // Generate AI response
        const user = await storage.getUser(messageData.userId!);
        const conversationHistory = await storage.getAllMessages();
        const allUsers = await storage.getAllUsers();
        
        if (user) {
          try {
            // Create user lookup map for efficient name resolution
            const userLookup = new Map(allUsers.map(u => [u.id, u.name]));
            
            // Prepare context for AI
            const context = {
              currentMessage: messageData.content,
              senderName: user.name,
              conversationHistory: conversationHistory.map(msg => ({
                id: msg.id,
                content: msg.content,
                senderName: userLookup.get(msg.userId) || "Unknown",
                timestamp: msg.timestamp.toISOString()
              })),
              relevantEntities: [] // Neo4j will provide context
            };

            const aiResponseContent = await simpleAIService.generateResponse(context);

            // Create AI response message
            const aiUser = await storage.getUserByName("AI Agent");
            if (aiUser) {
              const aiMessage = await storage.createMessage({
                userId: aiUser.id,
                content: aiResponseContent,
                mentions: messageData.mentions || []
              });

              // Update message to mark as AI response
              aiMessage.isAiResponse = true;

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

  // Clear all messages and knowledge graph
  app.delete("/api/messages", async (req, res) => {
    try {
      await storage.deleteAllMessages();
      
      // Knowledge graph data is already cleared by deleteAllMessages()
      console.log('✅ PostgreSQL knowledge graph data cleared with messages');
      
      // Clear Neo4j data as well
      try {
        await neo4jService.clearAllData();
      } catch (neo4jError) {
        console.warn('Failed to clear Neo4j data:', neo4jError);
      }
      
      res.json({ message: "All messages and knowledge graph data deleted successfully" });
    } catch (error) {
      console.error("Delete messages error:", error);
      res.status(500).json({ message: "Failed to delete messages", error: error.message });
    }
  });

  // Process all existing messages to populate knowledge graph
  app.post("/api/process-messages", async (req, res) => {
    try {
      // This route is disabled - entity extraction is handled by Neo4j service
      res.json({ 
        message: "Entity extraction is now handled by Neo4j service automatically",
        note: "No manual processing needed"
      });
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

  // Clear Neo4j graph database
  app.post("/api/clear-neo4j", async (req, res) => {
    try {
      const { neo4jService } = await import("./services/neo4j");
      await neo4jService.clearAllData();
      res.json({ message: "Neo4j database cleared successfully" });
    } catch (error) {
      res.status(500).json({ error: "Failed to clear Neo4j database" });
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

  // Import conversation script for testing
  app.post("/api/import-script", async (req, res) => {
    try {
      const { scriptContent } = req.body;
      if (!scriptContent) {
        return res.status(400).json({ message: "Script content is required" });
      }

      // Clear existing data first
      await storage.deleteAllMessages();
      try {
        await neo4jService.clearAllData();
      } catch (neo4jError) {
        console.warn('Failed to clear Neo4j data:', neo4jError);
      }

      // Import the script
      const { scriptImporter } = await import("./services/scriptImporter");
      const result = await scriptImporter.importScript(scriptContent);
      
      res.json({
        message: "Script imported successfully",
        ...result
      });
    } catch (error) {
      console.error("Import script error:", error);
      res.status(500).json({ message: "Failed to import script", error: error.message });
    }
  });

  // Run AI evaluation tests
  app.post("/api/run-evaluation", async (req, res) => {
    try {
      const { manualEvaluator } = await import("./services/manualEvaluator");
      const results = await manualEvaluator.runEvaluation();
      
      res.json({
        message: "Evaluation completed",
        ...results
      });
    } catch (error) {
      console.error("Evaluation error:", error);
      res.status(500).json({ message: "Failed to run evaluation", error: error.message });
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
