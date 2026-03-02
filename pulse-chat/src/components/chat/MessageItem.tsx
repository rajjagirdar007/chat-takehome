"use client";

import type { MessageWithProfile } from "@/lib/types";
import { UserAvatar } from "@/components/users/UserAvatar";
import { formatMessageTime } from "@/lib/utils";

interface MessageItemProps {
  message: MessageWithProfile;
  isOwn: boolean;
}

export function MessageItem({ message, isOwn }: MessageItemProps) {
  // System messages (joins, leaves) styled differently
  if (message.type === "system") {
    return (
      <div className="my-2 text-center text-sm text-text-muted">
        {message.content}
      </div>
    );
  }

  if (message.is_deleted) {
    return (
      <div className="my-2 text-sm italic text-text-muted">
        Message was deleted
      </div>
    );
  }

  const username = message.profiles?.username ?? "Unknown";
  const avatarColor = message.profiles?.avatar_color ?? "#6366f1";

  return (
    <div
      className={`group flex gap-3 rounded px-2 py-1.5 hover:bg-bg-tertiary/50 ${
        isOwn ? "bg-message-own/10" : ""
      }`}
    >
      <UserAvatar username={username} color={avatarColor} />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className="text-sm font-semibold text-text-primary">
            {username}
          </span>
          <span className="text-xs text-text-muted">
            {formatMessageTime(message.created_at)}
          </span>
        </div>
        <p className="whitespace-pre-wrap break-words text-sm text-text-secondary">
          {message.content}
        </p>
      </div>
    </div>
  );
}
