import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { chatApi } from "@/lib/chatApi";
import { type User, type Message, type InsertUser, type InsertMessage } from "@shared/schema";

export function useChat() {
  const queryClient = useQueryClient();
  const [error, setError] = useState<Error | null>(null);

  // Fetch users
  const { data: users = [], isLoading: usersLoading } = useQuery({
    queryKey: ["/api/users"],
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Fetch messages
  const { data: messages = [], isLoading: messagesLoading } = useQuery({
    queryKey: ["/api/messages"],
    refetchInterval: 1000, // Refetch every second for real-time updates
    staleTime: 0,
  });

  // Create user mutation
  const createUserMutation = useMutation({
    mutationFn: chatApi.createUser,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
    },
    onError: (error) => {
      setError(error);
    },
  });

  // Send message mutation
  const sendMessageMutation = useMutation({
    mutationFn: chatApi.sendMessage,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/messages"] });
    },
    onError: (error) => {
      setError(error);
    },
  });

  // Clear error when data changes
  useEffect(() => {
    if (error) {
      const timeout = setTimeout(() => setError(null), 5000);
      return () => clearTimeout(timeout);
    }
  }, [error]);

  const createUser = (userData: InsertUser) => {
    createUserMutation.mutate(userData);
  };

  const sendMessage = (messageData: InsertMessage) => {
    sendMessageMutation.mutate(messageData);
  };

  return {
    users: users as User[],
    messages: messages as Message[],
    createUser,
    sendMessage,
    isLoading: usersLoading || messagesLoading || createUserMutation.isPending || sendMessageMutation.isPending,
    error,
  };
}
