"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import type { PresenceState } from "@/lib/types";
import type { RealtimeChannel } from "@supabase/supabase-js";

interface UsePresenceReturn {
  onlineUsers: PresenceState[];
  typingUsers: PresenceState[];
  setTyping: (isTyping: boolean) => void;
}

export function usePresence(
  roomId: string | undefined,
  currentUser: { id: string; username: string; avatar_color: string } | null
): UsePresenceReturn {
  const [onlineUsers, setOnlineUsers] = useState<PresenceState[]>([]);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const supabase = createClient();

  useEffect(() => {
    if (!roomId || !currentUser) return;

    const channel = supabase.channel(`presence:${roomId}`);
    channelRef.current = channel;

    channel
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState<PresenceState>();
        // Flatten presence state: each key has an array of presences
        const users: PresenceState[] = [];
        for (const presences of Object.values(state)) {
          for (const presence of presences) {
            users.push(presence);
          }
        }
        setOnlineUsers(users);
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await channel.track({
            user_id: currentUser.id,
            username: currentUser.username,
            avatar_color: currentUser.avatar_color,
            online_at: new Date().toISOString(),
            typing: false,
          });
        }
      });

    return () => {
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [roomId, currentUser, supabase]);

  const setTyping = useCallback(
    (isTyping: boolean) => {
      if (!channelRef.current || !currentUser) return;
      channelRef.current.track({
        user_id: currentUser.id,
        username: currentUser.username,
        avatar_color: currentUser.avatar_color,
        online_at: new Date().toISOString(),
        typing: isTyping,
      });
    },
    [currentUser]
  );

  // Filter out current user from typing list
  const typingUsers = onlineUsers.filter(
    (u) => u.typing && u.user_id !== currentUser?.id
  );

  return { onlineUsers, typingUsers, setTyping };
}
