import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { UserAvatar } from "./UserAvatar";
import { Plus, Activity } from "lucide-react";
import { type User, type InsertUser } from "@shared/schema";

interface UserManagementSidebarProps {
  users: User[];
  activeUser: User | null;
  onUserSwitch: (user: User) => void;
  onCreateUser: (userData: InsertUser) => void;
  onToggleKnowledgeGraph: () => void;
}

const userColors = [
  "blue", "purple", "red", "green", "orange", "pink", "indigo", "teal", "yellow"
];

export function UserManagementSidebar({
  users,
  activeUser,
  onUserSwitch,
  onCreateUser,
  onToggleKnowledgeGraph,
}: UserManagementSidebarProps) {
  const [newUserName, setNewUserName] = useState("");

  const handleAddUser = () => {
    if (!newUserName.trim()) return;
    
    const initials = newUserName
      .split(" ")
      .map(word => word[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
    
    const color = userColors[users.length % userColors.length];
    
    onCreateUser({
      name: newUserName.trim(),
      initials,
      color,
    });
    
    setNewUserName("");
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleAddUser();
    }
  };

  const getLastActiveText = (user: User) => {
    if (!user.lastActiveAt) return "Never";
    
    const now = new Date();
    const lastActive = new Date(user.lastActiveAt);
    const diffMs = now.getTime() - lastActive.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return "Now";
    if (diffMins === 1) return "1 min ago";
    if (diffMins < 60) return `${diffMins} mins ago`;
    
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours === 1) return "1 hour ago";
    if (diffHours < 24) return `${diffHours} hours ago`;
    
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays === 1) return "1 day ago";
    return `${diffDays} days ago`;
  };

  return (
    <div className="w-80 bg-gray-100 border-r border-gray-200 flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Group Chat Simulation</h2>
        
        {/* Add New User */}
        <div className="mb-4">
          <div className="flex gap-2">
            <Input
              type="text"
              placeholder="Enter user name"
              value={newUserName}
              onChange={(e) => setNewUserName(e.target.value)}
              onKeyPress={handleKeyPress}
              className="flex-1"
            />
            <Button
              onClick={handleAddUser}
              size="sm"
              disabled={!newUserName.trim()}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Current Active User */}
        {activeUser && (
          <div className="mb-4">
            <Label className="text-sm font-medium text-gray-700 mb-2 block">
              Active User
            </Label>
            <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
              <UserAvatar
                user={activeUser}
                size="medium"
                className="ring-2 ring-blue-500"
              />
              <span className="font-medium text-gray-900">{activeUser.name}</span>
              <span className="text-xs text-blue-600 bg-blue-100 px-2 py-1 rounded">
                ACTIVE
              </span>
            </div>
          </div>
        )}
      </div>

      {/* User List */}
      <div className="flex-1 overflow-y-auto p-4">
        <h3 className="text-sm font-medium text-gray-700 mb-3">Users in Chat</h3>
        
        <div className="space-y-2">
          {users.map((user) => (
            <div
              key={user.id}
              className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                activeUser?.id === user.id
                  ? "bg-blue-50 border-blue-200"
                  : "bg-white border-gray-200 hover:bg-gray-50"
              }`}
              onClick={() => onUserSwitch(user)}
            >
              <UserAvatar
                user={user}
                size="medium"
                className={user.name === "AI Agent" ? "ring-2 ring-emerald-500" : ""}
              />
              <div className="flex-1">
                <div className="font-medium text-gray-900 flex items-center gap-2">
                  {user.name}
                  {user.name === "AI Agent" && (
                    <span className="text-xs text-emerald-600 bg-emerald-100 px-2 py-1 rounded">
                      BOT
                    </span>
                  )}
                </div>
                <div className="text-xs text-gray-500">
                  {user.name === "AI Agent" ? "Always active" : `Last active: ${getLastActiveText(user)}`}
                </div>
              </div>
              <div className="flex items-center">
                <Activity
                  className={`h-3 w-3 ${
                    user.name === "AI Agent" ? "text-emerald-500" : "text-gray-400"
                  }`}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Knowledge Graph Toggle */}
      <div className="p-4 border-t border-gray-200">
        <Button
          onClick={onToggleKnowledgeGraph}
          variant="outline"
          className="w-full"
        >
          <Activity className="h-4 w-4 mr-2" />
          View Knowledge Graph
        </Button>
      </div>
    </div>
  );
}
