"use client";

import { useState, useRef, useCallback } from "react";
import { Send } from "lucide-react";

interface MessageInputProps {
  onSend: (content: string) => Promise<boolean>;
  onTyping: (isTyping: boolean) => void;
  disabled?: boolean;
}

export function MessageInput({
  onSend,
  onTyping,
  disabled,
}: MessageInputProps) {
  const [content, setContent] = useState("");
  const [sending, setSending] = useState(false);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleTyping = useCallback(() => {
    onTyping(true);

    // Clear previous timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Stop typing indicator after 2 seconds of inactivity
    typingTimeoutRef.current = setTimeout(() => {
      onTyping(false);
    }, 2000);
  }, [onTyping]);

  async function handleSubmit(e?: React.FormEvent) {
    e?.preventDefault();
    const trimmed = content.trim();
    if (!trimmed || sending) return;

    setSending(true);
    onTyping(false);
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    const success = await onSend(trimmed);
    if (success) {
      setContent("");
    }
    setSending(false);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    // Enter sends, Shift+Enter adds newline
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="border-t border-border bg-bg-secondary p-4"
    >
      <div className="flex items-end gap-2">
        <textarea
          value={content}
          onChange={(e) => {
            setContent(e.target.value);
            handleTyping();
          }}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          placeholder="Type a message..."
          rows={1}
          className="max-h-32 flex-1 resize-none rounded bg-bg-tertiary p-3 text-sm text-text-primary outline-none placeholder:text-text-muted focus:ring-2 focus:ring-accent disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={!content.trim() || sending || disabled}
          className="rounded bg-accent p-3 text-white hover:bg-accent-hover disabled:opacity-50"
        >
          <Send className="h-4 w-4" />
        </button>
      </div>
    </form>
  );
}
