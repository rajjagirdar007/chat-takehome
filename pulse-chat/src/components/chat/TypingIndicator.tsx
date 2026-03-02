"use client";

import type { PresenceState } from "@/lib/types";

interface TypingIndicatorProps {
  typingUsers: PresenceState[];
}

export function TypingIndicator({ typingUsers }: TypingIndicatorProps) {
  if (typingUsers.length === 0) return null;

  let text: string;
  if (typingUsers.length === 1) {
    text = `${typingUsers[0].username} is typing`;
  } else if (typingUsers.length === 2) {
    text = `${typingUsers[0].username} and ${typingUsers[1].username} are typing`;
  } else {
    text = "Several people are typing";
  }

  return (
    <div className="px-4 py-1 text-xs text-text-muted">
      <span>{text}</span>
      <span className="ml-1 inline-flex">
        <span className="typing-dot">.</span>
        <span className="typing-dot">.</span>
        <span className="typing-dot">.</span>
      </span>
    </div>
  );
}
