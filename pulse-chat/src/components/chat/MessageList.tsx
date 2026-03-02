"use client";

import { useEffect, useRef } from "react";
import type { MessageWithProfile } from "@/lib/types";
import { MessageItem } from "./MessageItem";
import { formatDayDivider } from "@/lib/utils";

interface MessageListProps {
  messages: MessageWithProfile[];
  currentUserId: string | undefined;
  loading: boolean;
  hasMore: boolean;
  onLoadMore: () => Promise<void>;
}

export function MessageList({
  messages,
  currentUserId,
  loading,
  hasMore,
  onLoadMore,
}: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const prevMessageCount = useRef(messages.length);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (messages.length > prevMessageCount.current) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
    prevMessageCount.current = messages.length;
  }, [messages.length]);

  // Scroll to bottom on initial load
  useEffect(() => {
    if (!loading) {
      bottomRef.current?.scrollIntoView();
    }
  }, [loading]);

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center text-text-muted">
        Loading messages...
      </div>
    );
  }

  if (messages.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center text-text-muted">
        No messages yet. Start the conversation!
      </div>
    );
  }

  // Group messages by day for date dividers
  let lastDate = "";

  return (
    <div ref={containerRef} className="flex-1 overflow-y-auto px-4 py-2">
      {hasMore && (
        <div className="mb-4 text-center">
          <button
            onClick={onLoadMore}
            className="text-sm text-accent hover:underline"
          >
            Load older messages
          </button>
        </div>
      )}

      {messages.map((message) => {
        const messageDate = new Date(message.created_at).toDateString();
        let showDivider = false;

        if (messageDate !== lastDate) {
          showDivider = true;
          lastDate = messageDate;
        }

        return (
          <div key={message.id}>
            {showDivider && (
              <div className="my-4 flex items-center gap-3">
                <div className="h-px flex-1 bg-border" />
                <span className="text-xs font-medium text-text-muted">
                  {formatDayDivider(message.created_at)}
                </span>
                <div className="h-px flex-1 bg-border" />
              </div>
            )}
            <MessageItem
              message={message}
              isOwn={message.user_id === currentUserId}
            />
          </div>
        );
      })}

      <div ref={bottomRef} />
    </div>
  );
}
