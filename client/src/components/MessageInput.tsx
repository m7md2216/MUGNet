import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send, Paperclip, Smile } from "lucide-react";
import { UserAvatar } from "./UserAvatar";
import { type User } from "@shared/schema";

interface MessageInputProps {
  users: User[];
  activeUser: User | null;
  onSendMessage: (content: string, mentions: string[]) => void;
  disabled?: boolean;
}

export function MessageInput({ users, activeUser, onSendMessage, disabled }: MessageInputProps) {
  const [message, setMessage] = useState("");
  const [showMentions, setShowMentions] = useState(false);
  const [mentionQuery, setMentionQuery] = useState("");
  const [mentionPosition, setMentionPosition] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setMessage(value);

    // Check for @ mentions
    const cursorPosition = e.target.selectionStart || 0;
    const textBeforeCursor = value.substring(0, cursorPosition);
    const lastAtIndex = textBeforeCursor.lastIndexOf("@");
    
    if (lastAtIndex !== -1) {
      const afterAt = textBeforeCursor.substring(lastAtIndex + 1);
      
      // Check if we're in the middle of a mention (no spaces after @)
      if (!afterAt.includes(" ")) {
        setMentionQuery(afterAt.toLowerCase());
        setMentionPosition(lastAtIndex);
        setShowMentions(true);
      } else {
        setShowMentions(false);
      }
    } else {
      setShowMentions(false);
    }
  };

  const handleMentionSelect = (user: User) => {
    const beforeMention = message.substring(0, mentionPosition);
    const afterMention = message.substring(mentionPosition + mentionQuery.length + 1);
    
    const newMessage = beforeMention + `@${user.name.toLowerCase().replace(/\s+/g, "")} ` + afterMention;
    setMessage(newMessage);
    setShowMentions(false);
    inputRef.current?.focus();
  };

  const extractMentions = (content: string): string[] => {
    const mentionRegex = /@(\w+)/g;
    const mentions = [];
    let match;
    
    while ((match = mentionRegex.exec(content)) !== null) {
      mentions.push(match[1]);
    }
    
    return mentions;
  };

  const handleSendMessage = () => {
    if (!message.trim() || disabled) return;
    
    const mentions = extractMentions(message);
    onSendMessage(message.trim(), mentions);
    setMessage("");
    setShowMentions(false);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const filteredUsers = users.filter(user => 
    user.name.toLowerCase().includes(mentionQuery) && 
    user.id !== activeUser?.id
  );

  return (
    <div className="p-4 bg-white border-t border-gray-200">
      <div className="flex items-center gap-3">
        <div className="flex-1 relative">
          <Input
            ref={inputRef}
            type="text"
            placeholder="Type your message... (use @username to mention)"
            value={message}
            onChange={handleInputChange}
            onKeyPress={handleKeyPress}
            disabled={disabled}
            className="pr-12"
          />
          <Button
            onClick={handleSendMessage}
            size="sm"
            disabled={!message.trim() || disabled}
            className="absolute right-1 top-1/2 transform -translate-y-1/2 h-8 w-8 p-0"
          >
            <Send className="h-4 w-4" />
          </Button>

          {/* Mention suggestions */}
          {showMentions && filteredUsers.length > 0 && (
            <div className="absolute bottom-full left-0 right-0 mb-2 bg-white border border-gray-200 rounded-lg shadow-lg max-h-32 overflow-y-auto z-10">
              {filteredUsers.map((user) => (
                <div
                  key={user.id}
                  className="p-2 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-b-0"
                  onClick={() => handleMentionSelect(user)}
                >
                  <div className="flex items-center gap-2">
                    <UserAvatar user={user} size="small" />
                    <span className="text-sm">{user.name}</span>
                    {user.name === "AI Agent" && (
                      <span className="text-xs text-emerald-600 bg-emerald-100 px-1 py-0.5 rounded">
                        BOT
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="text-gray-500 hover:text-gray-700"
            disabled={disabled}
          >
            <Paperclip className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-gray-500 hover:text-gray-700"
            disabled={disabled}
          >
            <Smile className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
