"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Search, X, Hash } from "lucide-react";
import { useSearch } from "@/lib/hooks/useSearch";
import { UserAvatar } from "@/components/users/UserAvatar";
import { formatMessageTime } from "@/lib/utils";

interface MessageSearchProps {
  userId: string | undefined;
  onClose: () => void;
}

export function MessageSearch({ userId, onClose }: MessageSearchProps) {
  const [query, setQuery] = useState("");
  const { results, loading, search, clear } = useSearch(userId);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Close on Escape
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  function handleChange(value: string) {
    setQuery(value);
    if (value.trim()) {
      search(value);
    } else {
      clear();
    }
  }

  function handleResultClick(roomSlug: string) {
    onClose();
    router.push(`/chat/${roomSlug}`);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 pt-20">
      <div className="w-full max-w-2xl rounded-lg bg-bg-secondary shadow-2xl">
        {/* Search input */}
        <div className="flex items-center gap-3 border-b border-border px-4 py-3">
          <Search className="h-5 w-5 text-text-muted" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => handleChange(e.target.value)}
            placeholder="Search messages..."
            className="flex-1 bg-transparent text-text-primary outline-none placeholder:text-text-muted"
          />
          <button
            onClick={onClose}
            className="text-text-muted hover:text-text-primary"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Results */}
        <div className="max-h-96 overflow-y-auto">
          {loading && (
            <div className="p-4 text-center text-sm text-text-muted">
              Searching...
            </div>
          )}

          {!loading && query.trim() && results.length === 0 && (
            <div className="p-4 text-center text-sm text-text-muted">
              No messages found
            </div>
          )}

          {results.map((result) => (
            <button
              key={result.id}
              onClick={() => handleResultClick(result.room_slug)}
              className="flex w-full gap-3 border-b border-border/50 px-4 py-3 text-left hover:bg-bg-tertiary"
            >
              <UserAvatar
                username={result.username}
                color={result.avatar_color}
                size="sm"
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-text-primary">
                    {result.username}
                  </span>
                  <span className="flex items-center gap-1 text-xs text-text-muted">
                    <Hash className="h-3 w-3" />
                    {result.room_name}
                  </span>
                  <span className="ml-auto text-xs text-text-muted">
                    {formatMessageTime(result.created_at)}
                  </span>
                </div>
                <p className="truncate text-sm text-text-secondary">
                  {result.content}
                </p>
              </div>
            </button>
          ))}
        </div>

        {/* Shortcut hint */}
        {!query.trim() && (
          <div className="p-4 text-center text-sm text-text-muted">
            Search across all your rooms
          </div>
        )}
      </div>
    </div>
  );
}
