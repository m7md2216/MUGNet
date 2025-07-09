import { useEffect, useRef } from "react";
import { UserAvatar } from "./UserAvatar";
import { Loader2, Database, Network } from "lucide-react";
import { type Message, type User } from "@shared/schema";

interface MessagesContainerProps {
  messages: Message[];
  users: User[];
  isLoading: boolean;
}

export function MessagesContainer({ messages, users, isLoading }: MessagesContainerProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const getUserById = (userId: number) => {
    return users.find(user => user.id === userId);
  };

  const formatTime = (timestamp: Date) => {
    return new Date(timestamp).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const renderMentions = (content: string) => {
    return content.replace(/@(\w+)/g, '<span class="bg-blue-100 text-blue-800 px-1 py-0.5 rounded text-sm">@$1</span>');
  };

  if (messages.length === 0 && !isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="text-center">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Network className="h-8 w-8 text-gray-400" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No messages yet</h3>
          <p className="text-gray-500">Start a conversation by sending a message!</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4">
      {/* System Message */}
      <div className="flex justify-center">
        <div className="text-xs text-gray-500 bg-gray-100 px-3 py-1 rounded-full">
          Chat simulation started
        </div>
      </div>

      {/* Messages */}
      {messages.map((message) => {
        const user = getUserById(message.userId!);
        if (!user) return null;

        const isAiMessage = message.isAiResponse || user.name === "AI Agent";

        return (
          <div
            key={message.id}
            className="flex items-start gap-3 animate-in slide-in-from-bottom-2 duration-300"
          >
            <UserAvatar
              user={user}
              size="medium"
              className="flex-shrink-0"
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="font-medium text-gray-900">{user.name}</span>
                {isAiMessage && (
                  <span className="text-xs text-emerald-600 bg-emerald-100 px-2 py-1 rounded">
                    BOT
                  </span>
                )}
                <span className="text-xs text-gray-500">
                  {formatTime(message.timestamp!)}
                </span>
              </div>
              <div
                className={`p-3 rounded-lg border ${
                  isAiMessage
                    ? "bg-gradient-to-r from-emerald-50 to-green-50 border-emerald-200"
                    : "bg-white border-gray-200"
                }`}
              >
                <p
                  className="text-gray-900"
                  dangerouslySetInnerHTML={{
                    __html: renderMentions(message.content)
                  }}
                />
                {isAiMessage && (
                  <div className="mt-2 text-xs text-gray-600 flex items-center gap-1">
                    <Database className="h-3 w-3" />
                    <span>Retrieved from knowledge graph</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })}

      {/* Loading indicator */}
      {isLoading && (
        <div className="flex items-start gap-3 animate-in slide-in-from-bottom-2 duration-300">
          <div className="w-8 h-8 bg-emerald-500 rounded-full flex items-center justify-center text-white font-semibold flex-shrink-0">
            <Loader2 className="h-4 w-4 animate-spin" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-medium text-gray-900">AI Agent</span>
              <span className="text-xs text-emerald-600 bg-emerald-100 px-2 py-1 rounded">
                BOT
              </span>
              <span className="text-xs text-gray-500">
                {formatTime(new Date())}
              </span>
            </div>
            <div className="bg-gradient-to-r from-emerald-50 to-green-50 border border-emerald-200 p-3 rounded-lg">
              <div className="flex items-center gap-2 text-gray-600">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Processing knowledge graph and retrieving conversation context...</span>
              </div>
            </div>
          </div>
        </div>
      )}

      <div ref={messagesEndRef} />
    </div>
  );
}
