import { useState, useEffect } from "react";
import { useChat } from "@/hooks/useChat";
import { UserManagementSidebar } from "@/components/UserManagementSidebar";
import { MessagesContainer } from "@/components/MessagesContainer";
import { MessageInput } from "@/components/MessageInput";
import { KnowledgeGraphSidebar } from "@/components/KnowledgeGraphSidebar";
import { Button } from "@/components/ui/button";
import { Trash2, Download } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { type User } from "@shared/schema";

export default function GroupChat() {
  const [activeUser, setActiveUser] = useState<User | null>(null);
  const [isKnowledgeGraphOpen, setIsKnowledgeGraphOpen] = useState(false);
  const { toast } = useToast();
  
  const {
    users,
    messages,
    createUser,
    sendMessage,
    deleteAllMessages,
    isLoading,
    error
  } = useChat();

  useEffect(() => {
    if (users.length > 0 && !activeUser) {
      // Set first non-AI user as active, or first user if only AI exists
      const firstUser = users.find(u => u.name !== "AI Agent") || users[0];
      setActiveUser(firstUser);
    }
  }, [users, activeUser]);

  const handleUserSwitch = (user: User) => {
    setActiveUser(user);
    toast({
      title: "User switched",
      description: `Now chatting as ${user.name}`,
    });
  };

  const handleSendMessage = (content: string, mentions: string[]) => {
    if (!activeUser) {
      toast({
        title: "Error",
        description: "Please select an active user",
        variant: "destructive",
      });
      return;
    }

    sendMessage({
      userId: activeUser.id,
      content,
      mentions,
    });
  };

  const handleClearChat = () => {
    deleteAllMessages();
    toast({
      title: "Chat cleared",
      description: "All messages have been cleared",
    });
  };

  const handleExportChat = () => {
    // Export chat functionality
    const chatData = {
      users,
      messages,
      timestamp: new Date().toISOString(),
    };
    
    const blob = new Blob([JSON.stringify(chatData, null, 2)], {
      type: "application/json",
    });
    
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `group-chat-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    toast({
      title: "Chat exported",
      description: "Chat data has been downloaded",
    });
  };

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-600 mb-2">Error</h1>
          <p className="text-gray-600">{error.message}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Left Sidebar - User Management */}
      <UserManagementSidebar
        users={users}
        activeUser={activeUser}
        onUserSwitch={handleUserSwitch}
        onCreateUser={createUser}
        onToggleKnowledgeGraph={() => setIsKnowledgeGraphOpen(!isKnowledgeGraphOpen)}
      />

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {/* Chat Header */}
        <div className="p-4 bg-white border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-semibold text-gray-900">Group Chat</h1>
              <span className="text-sm text-gray-500">{users.length} members</span>
            </div>
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClearChat}
                className="text-gray-500 hover:text-gray-700"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleExportChat}
                className="text-gray-500 hover:text-gray-700"
              >
                <Download className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Messages Container */}
        <MessagesContainer messages={messages} users={users} isLoading={isLoading} />

        {/* Message Input */}
        <MessageInput
          users={users}
          activeUser={activeUser}
          onSendMessage={handleSendMessage}
          disabled={!activeUser}
        />
      </div>

      {/* Right Sidebar - Knowledge Graph */}
      {isKnowledgeGraphOpen && (
        <KnowledgeGraphSidebar
          onClose={() => setIsKnowledgeGraphOpen(false)}
        />
      )}
    </div>
  );
}
