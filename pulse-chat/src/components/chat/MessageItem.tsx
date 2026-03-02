"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Trash2, FileIcon, Download } from "lucide-react";
import type { MessageWithProfile, FileMetadata } from "@/lib/types";
import { UserAvatar } from "@/components/users/UserAvatar";
import { formatMessageTime, formatFileSize } from "@/lib/utils";
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

  // Cast once for file/image messages — avoids repeated inline casts
  const fileMeta = (message.type === "image" || message.type === "file")
    ? (message.metadata as unknown as FileMetadata)
    : null;

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
        {/* Render content based on message type */}
        {message.type === "image" && fileMeta ? (
          <div className="mt-1">
            <a
              href={fileMeta.file_url}
              target="_blank"
              rel="noopener noreferrer"
            >
              {/* External user-uploaded URL — next/image requires domain allowlisting */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={fileMeta.file_url}
                alt={fileMeta.file_name}
                loading="lazy"
                className="max-h-72 max-w-sm rounded border border-border object-contain"
              />
            </a>
            {/* Show caption if it differs from the filename */}
            {message.content !== fileMeta.file_name && (
              <p className="mt-1 text-sm text-text-secondary">{message.content}</p>
            )}
          </div>
        ) : message.type === "file" && fileMeta ? (
          <a
            href={fileMeta.file_url}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-1 flex items-center gap-3 rounded border border-border bg-bg-tertiary px-3 py-2 hover:bg-bg-tertiary/80"
            style={{ maxWidth: "20rem" }}
          >
            <FileIcon className="h-8 w-8 shrink-0 text-text-muted" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-text-primary">
                {fileMeta.file_name}
              </p>
              <p className="text-xs text-text-muted">
                {formatFileSize(fileMeta.file_size)}
              </p>
            </div>
            <Download className="h-4 w-4 shrink-0 text-text-muted" />
          </a>
        ) : (
          <div className="markdown-content max-w-none whitespace-pre-wrap break-words text-sm text-text-secondary">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {message.content}
            </ReactMarkdown>
          </div>
        )}
      </div>
    </div>
  );
}
