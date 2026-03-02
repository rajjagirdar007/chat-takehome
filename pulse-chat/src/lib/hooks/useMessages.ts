"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import type { MessageWithProfile } from "@/lib/types";

interface UseMessagesReturn {
  messages: MessageWithProfile[];
  loading: boolean;
  sendMessage: (content: string) => Promise<boolean>;
  loadMore: () => Promise<void>;
  hasMore: boolean;
}

const PAGE_SIZE = 50;

export function useMessages(
  roomId: string | undefined,
  userId: string | undefined
): UseMessagesReturn {
  const [messages, setMessages] = useState<MessageWithProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(true);
  const supabase = createClient();
  // Track room ID to avoid stale subscription callbacks
  const currentRoomId = useRef(roomId);

  useEffect(() => {
    currentRoomId.current = roomId;
  }, [roomId]);

  const fetchMessages = useCallback(async () => {
    if (!roomId) return;

    setLoading(true);
    const { data, error } = await supabase
      .from("messages")
      .select("*, profiles:user_id(username, avatar_color)")
      .eq("room_id", roomId)
      .eq("is_deleted", false)
      .order("created_at", { ascending: true })
      .limit(PAGE_SIZE);

    if (error) {
      console.error("Failed to fetch messages:", error.message);
    } else {
      setMessages(data as MessageWithProfile[]);
      setHasMore(data.length === PAGE_SIZE);
    }
    setLoading(false);
  }, [roomId, supabase]);

  useEffect(() => {
    setMessages([]);
    fetchMessages();

    if (!roomId) return;

    // Subscribe to new messages in this room via Postgres CDC
    const channel = supabase
      .channel(`room-messages:${roomId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `room_id=eq.${roomId}`,
        },
        async (payload) => {
          // Only process if still on same room
          if (currentRoomId.current !== roomId) return;

          const newMessage = payload.new as MessageWithProfile;

          // Fetch the profile for this message
          const { data: profile } = await supabase
            .from("profiles")
            .select("username, avatar_color")
            .eq("id", newMessage.user_id!)
            .single();

          newMessage.profiles = profile;

          setMessages((prev) => {
            // Avoid duplicates (optimistic update may have already added it)
            if (prev.some((m) => m.id === newMessage.id)) return prev;
            return [...prev, newMessage];
          });
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "messages",
          filter: `room_id=eq.${roomId}`,
        },
        (payload) => {
          if (currentRoomId.current !== roomId) return;
          const updated = payload.new as MessageWithProfile;
          setMessages((prev) =>
            prev.map((m) => (m.id === updated.id ? { ...m, ...updated } : m))
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomId, supabase, fetchMessages]);

  const sendMessage = useCallback(
    async (content: string): Promise<boolean> => {
      if (!roomId || !userId) return false;

      const { error } = await supabase
        .from("messages")
        .insert({ room_id: roomId, user_id: userId, content });

      if (error) {
        console.error("Failed to send message:", error.message);
        return false;
      }
      return true;
    },
    [roomId, userId, supabase]
  );

  const loadMore = useCallback(async () => {
    if (!roomId || messages.length === 0) return;

    const oldestMessage = messages[0];
    const { data } = await supabase
      .from("messages")
      .select("*, profiles:user_id(username, avatar_color)")
      .eq("room_id", roomId)
      .eq("is_deleted", false)
      .lt("created_at", oldestMessage.created_at)
      .order("created_at", { ascending: false })
      .limit(PAGE_SIZE);

    if (data) {
      // Reverse because we fetched descending, prepend to existing
      setMessages((prev) => [...data.reverse(), ...prev]);
      setHasMore(data.length === PAGE_SIZE);
    }
  }, [roomId, messages, supabase]);

  return { messages, loading, sendMessage, loadMore, hasMore };
}
