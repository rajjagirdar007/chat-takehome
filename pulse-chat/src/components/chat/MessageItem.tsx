"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Trash2 } from "lucide-react";
import type { MessageWithProfile } from "@/lib/types";
import { UserAvatar } from "@/components/users/UserAvatar";
import { formatMessageTime } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";

interface MessageItemProps {
  message: MessageWithProfile;
  isOwn: boolean;
}

export function MessageItem({ message, isOwn }: MessageItemProps) {
  const [deleting, setDeleting] = useState(false);

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

  async function handleDelete() {
    setDeleting(true);
    const supabase = createClient();
    await supabase
      .from("messages")
      .update({ is_deleted: true })
      .eq("id", message.id);
    setDeleting(false);
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
          {isOwn && (
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="ml-auto hidden text-text-muted hover:text-unread group-hover:inline-flex"
              title="Delete message"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        <div className="markdown-content max-w-none whitespace-pre-wrap break-words text-sm text-text-secondary">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {message.content}
          </ReactMarkdown>
        </div>
      </div>
    </div>
  );
}
