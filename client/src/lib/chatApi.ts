import { apiRequest } from "./queryClient";
import { type InsertUser, type InsertMessage } from "@shared/schema";

export const chatApi = {
  createUser: async (userData: InsertUser) => {
    const response = await apiRequest("POST", "/api/users", userData);
    return response.json();
  },

  sendMessage: async (messageData: InsertMessage) => {
    const response = await apiRequest("POST", "/api/messages", messageData);
    return response.json();
  },

  updateUserActivity: async (userId: number) => {
    const response = await apiRequest("PUT", `/api/users/${userId}/activity`);
    return response.json();
  },

  getKnowledgeGraph: async () => {
    const response = await apiRequest("GET", "/api/knowledge-graph");
    return response.json();
  },

  getEntityConnections: async (entityName: string, depth: number = 2) => {
    const response = await apiRequest("GET", `/api/knowledge-graph/connections/${entityName}?depth=${depth}`);
    return response.json();
  },

  getUserContext: async (username: string) => {
    const response = await apiRequest("GET", `/api/knowledge-graph/context/${username}`);
    return response.json();
  },

  getConversationThreads: async () => {
    const response = await apiRequest("GET", "/api/conversation-threads");
    return response.json();
  },

  deleteAllMessages: async () => {
    const response = await apiRequest("DELETE", "/api/messages");
    return response.json();
  },

  processMessages: async () => {
    const response = await apiRequest("POST", "/api/process-messages", {});
    return response.json();
  },
};
