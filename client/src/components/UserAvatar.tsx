import { type User } from "@shared/schema";
import { cn } from "@/lib/utils";
import { Bot } from "lucide-react";

interface UserAvatarProps {
  user: User;
  size?: "small" | "medium" | "large";
  className?: string;
}

const sizeClasses = {
  small: "w-6 h-6 text-xs",
  medium: "w-8 h-8 text-sm",
  large: "w-12 h-12 text-base",
};

const colorClasses = {
  blue: "bg-blue-500",
  purple: "bg-purple-500",
  red: "bg-red-500",
  green: "bg-green-500",
  orange: "bg-orange-500",
  pink: "bg-pink-500",
  indigo: "bg-indigo-500",
  teal: "bg-teal-500",
  yellow: "bg-yellow-500",
  emerald: "bg-emerald-500",
};

export function UserAvatar({ user, size = "medium", className }: UserAvatarProps) {
  const sizeClass = sizeClasses[size];
  const colorClass = colorClasses[user.color as keyof typeof colorClasses] || "bg-gray-500";

  return (
    <div
      className={cn(
        "rounded-full flex items-center justify-center text-white font-semibold transition-transform hover:scale-105",
        sizeClass,
        colorClass,
        className
      )}
    >
      {user.name === "AI Agent" ? (
        <Bot className="h-4 w-4" />
      ) : (
        <span>{user.initials}</span>
      )}
    </div>
  );
}
