import { format, isToday, isYesterday } from "date-fns";

/**
 * Converts a room name to a URL-safe slug.
 * "General Discussion" -> "general-discussion"
 */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Formats a timestamp for display in the message list.
 * Shows time for today, "Yesterday" prefix, or full date for older.
 */
export function formatMessageTime(dateString: string): string {
  const date = new Date(dateString);
  return format(date, "h:mm a");
}

/**
 * Formats a date for day dividers in the message list.
 * "Today", "Yesterday", or "March 1, 2026"
 */
export function formatDayDivider(dateString: string): string {
  const date = new Date(dateString);
  if (isToday(date)) return "Today";
  if (isYesterday(date)) return "Yesterday";
  return format(date, "MMMM d, yyyy");
}

/**
 * Gets the first letter of a username for avatar display.
 */
export function getInitial(username: string): string {
  return username.charAt(0).toUpperCase();
}

/**
 * Creates a deterministic DM room slug from two user IDs.
 * Sorts UUIDs lexicographically so the same pair always produces the same slug.
 */
export function createDmSlug(userId1: string, userId2: string): string {
  const sorted = [userId1, userId2].sort();
  return `dm--${sorted[0]}--${sorted[1]}`;
}

/**
 * Formats a byte count into a human-readable file size string.
 * e.g. 1024 -> "1.0 KB", 1048576 -> "1.0 MB"
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}
