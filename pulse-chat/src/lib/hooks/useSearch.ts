"use client";

import { useState, useCallback, useRef } from "react";
import { createClient } from "@/lib/supabase/client";

export interface SearchResult {
  id: string;
  room_id: string;
  user_id: string | null;
  content: string;
  type: string;
  created_at: string;
  room_name: string;
  room_slug: string;
  username: string;
  avatar_color: string;
}

interface UseSearchReturn {
  results: SearchResult[];
  loading: boolean;
  search: (query: string) => void;
  clear: () => void;
}

export function useSearch(userId: string | undefined): UseSearchReturn {
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const supabase = createClient();
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  const search = useCallback(
    (query: string) => {
      if (!userId || !query.trim()) {
        setResults([]);
        setLoading(false);
        return;
      }

      setLoading(true);

      // Cancel any pending search
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }

      debounceRef.current = setTimeout(async () => {
        // First get the rooms the user is a member of
        const { data: memberships } = await supabase
          .from("room_members")
          .select("room_id")
          .eq("user_id", userId);

        if (!memberships || memberships.length === 0) {
          setResults([]);
          setLoading(false);
          return;
        }

        const roomIds = memberships.map((m) => m.room_id);

        // Search messages using ilike (partial match, case-insensitive)
        const { data: messages, error } = await supabase
          .from("messages")
          .select("id, room_id, user_id, content, type, created_at")
          .in("room_id", roomIds)
          .eq("is_deleted", false)
          .ilike("content", `%${query.trim()}%`)
          .order("created_at", { ascending: false })
          .limit(20);

        if (error) {
          console.error("Search failed:", error.message);
          setResults([]);
          setLoading(false);
          return;
        }

        if (!messages || messages.length === 0) {
          setResults([]);
          setLoading(false);
          return;
        }

        // Fetch room and profile info for results
        const uniqueRoomIds = [...new Set(messages.map((m) => m.room_id))];
        const uniqueUserIds = [...new Set(messages.map((m) => m.user_id).filter(Boolean))] as string[];

        const [roomsRes, profilesRes] = await Promise.all([
          supabase.from("rooms").select("id, name, slug").in("id", uniqueRoomIds),
          uniqueUserIds.length > 0
            ? supabase.from("profiles").select("id, username, avatar_color").in("id", uniqueUserIds)
            : Promise.resolve({ data: [] }),
        ]);

        const roomMap = new Map((roomsRes.data ?? []).map((r) => [r.id, r]));
        const profileMap = new Map((profilesRes.data ?? []).map((p) => [p.id, p]));

        const enriched: SearchResult[] = messages.map((m) => {
          const room = roomMap.get(m.room_id);
          const profile = m.user_id ? profileMap.get(m.user_id) : null;
          return {
            ...m,
            room_name: room?.name ?? "Unknown",
            room_slug: room?.slug ?? "",
            username: profile?.username ?? "Unknown",
            avatar_color: profile?.avatar_color ?? "#6366f1",
          };
        });

        setResults(enriched);
        setLoading(false);
      }, 300);
    },
    [userId, supabase]
  );

  const clear = useCallback(() => {
    setResults([]);
    setLoading(false);
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
  }, []);

  return { results, loading, search, clear };
}
