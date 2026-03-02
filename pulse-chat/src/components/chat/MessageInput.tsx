"use client";

import { useState, useRef, useCallback } from "react";
import { Send, Paperclip, X, FileIcon } from "lucide-react";
import { formatFileSize } from "@/lib/utils";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

interface MessageInputProps {
  onSend: (content: string) => Promise<boolean>;
  onSendFile: (file: File, caption?: string) => Promise<boolean>;
  onTyping: (isTyping: boolean) => void;
  disabled?: boolean;
}

export function MessageInput({
  onSend,
  onSendFile,
  onTyping,
  disabled,
}: MessageInputProps) {
  const [content, setContent] = useState("");
  const [sending, setSending] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [filePreviewUrl, setFilePreviewUrl] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileError(null);

    if (file.size > MAX_FILE_SIZE) {
      setFileError("File too large. Maximum size is 10MB.");
      // Reset file input so the same file can be re-selected
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    // Revoke previous blob URL before replacing
    if (filePreviewUrl) {
      URL.revokeObjectURL(filePreviewUrl);
    }

    setSelectedFile(file);

    // Generate thumbnail preview for images
    if (file.type.startsWith("image/")) {
      const url = URL.createObjectURL(file);
      setFilePreviewUrl(url);
    } else {
      setFilePreviewUrl(null);
    }

    // Reset file input so re-selecting the same file triggers onChange
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function clearFile() {
    if (filePreviewUrl) {
      URL.revokeObjectURL(filePreviewUrl);
    }
    setSelectedFile(null);
    setFilePreviewUrl(null);
    setFileError(null);
  }

  async function handleSubmit(e?: React.FormEvent) {
    e?.preventDefault();

    if (sending) return;

    // If a file is attached, send it as a file message
    if (selectedFile) {
      setSending(true);
      onTyping(false);
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);

      const caption = content.trim() || undefined;
      const success = await onSendFile(selectedFile, caption);
      if (success) {
        clearFile();
        setContent("");
      } else {
        setFileError("Failed to upload file. Please try again.");
      }
      setSending(false);
      return;
    }

    // Otherwise send as text
    const trimmed = content.trim();
    if (!trimmed) return;

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

  const canSubmit = selectedFile || content.trim();

  return (
    <form
      onSubmit={handleSubmit}
      className="border-t border-border bg-bg-secondary p-4"
    >
      {/* File preview bar */}
      {selectedFile && (
        <div className="mb-2 flex items-center gap-3 rounded bg-bg-tertiary px-3 py-2">
          {filePreviewUrl ? (
            // Local blob URL — next/image can't optimize this
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={filePreviewUrl}
              alt={selectedFile.name}
              className="h-10 w-10 rounded object-cover"
            />
          ) : (
            <FileIcon className="h-10 w-10 text-text-muted" />
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-text-primary">
              {selectedFile.name}
            </p>
            <p className="text-xs text-text-muted">
              {formatFileSize(selectedFile.size)}
            </p>
          </div>
          <button
            type="button"
            onClick={clearFile}
            className="text-text-muted hover:text-text-primary"
            title="Remove attachment"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* File size error */}
      {fileError && (
        <p className="mb-2 text-sm text-unread">{fileError}</p>
      )}

      <div className="flex items-end gap-2">
        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          onChange={handleFileSelect}
          className="hidden"
        />

        {/* Attachment button */}
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled || sending}
          className="rounded p-3 text-text-muted hover:bg-bg-tertiary hover:text-text-primary disabled:opacity-50"
          title="Attach file"
        >
          <Paperclip className="h-4 w-4" />
        </button>

        <textarea
          value={content}
          onChange={(e) => {
            setContent(e.target.value);
            handleTyping();
          }}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          placeholder={selectedFile ? "Add a caption..." : "Type a message..."}
          rows={1}
          className="max-h-32 flex-1 resize-none rounded bg-bg-tertiary p-3 text-sm text-text-primary outline-none placeholder:text-text-muted focus:ring-2 focus:ring-accent disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={!canSubmit || sending || disabled}
          className="rounded bg-accent p-3 text-white hover:bg-accent-hover disabled:opacity-50"
        >
          <Send className="h-4 w-4" />
        </button>
      </div>
    </form>
  );
}
