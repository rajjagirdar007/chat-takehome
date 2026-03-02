"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Room, RoomMemberWithRoom } from "@/lib/types";
import { slugify } from "@/lib/utils";

interface UseRoomsReturn {
  rooms: RoomMemberWithRoom[];
  allRooms: Room[];
  unreadCounts: Record<string, number>;
  loading: boolean;
  createRoom: (name: string, description: string) => Promise<Room | null>;
  joinRoom: (roomId: string) => Promise<boolean>;
  leaveRoom: (roomId: string) => Promise<boolean>;
  refreshRooms: () => Promise<void>;
}

export function useRooms(userId: string | undefined): UseRoomsReturn {
  const [rooms, setRooms] = useState<RoomMemberWithRoom[]>([]);
  const [allRooms, setAllRooms] = useState<Room[]>([]);
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  const fetchUnreadCounts = useCallback(
    async (memberships: RoomMemberWithRoom[]) => {
      const counts: Record<string, number> = {};

      // Fetch unread count for each room in parallel
      await Promise.all(
        memberships.map(async (membership) => {
          const { count } = await supabase
            .from("messages")
            .select("*", { count: "exact", head: true })
            .eq("room_id", membership.room_id)
            .eq("is_deleted", false)
            .gt("created_at", membership.last_read_at);

          counts[membership.room_id] = count ?? 0;
        })
      );

      setUnreadCounts(counts);
    },
    [supabase]
  );

  const fetchRooms = useCallback(async () => {
    if (!userId) return;

    // Fetch rooms user is a member of
    const { data: memberRooms } = await supabase
      .from("room_members")
      .select("*, rooms(*)")
      .eq("user_id", userId);

    if (memberRooms) {
      const typed = memberRooms as RoomMemberWithRoom[];
      setRooms(typed);
      fetchUnreadCounts(typed);
    }

    // Fetch all rooms (for "browse rooms" / join)
    const { data: all } = await supabase
      .from("rooms")
      .select("*")
      .order("created_at", { ascending: true });

    if (all) {
      setAllRooms(all);
    }

    setLoading(false);
  }, [userId, supabase, fetchUnreadCounts]);

  useEffect(() => {
    fetchRooms();

    // Subscribe to room_members changes for live sidebar updates
    const memberChannel = supabase
      .channel("room-members-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "room_members" },
        () => {
          fetchRooms();
        }
      )
      .subscribe();

    // Subscribe to ALL new messages to update unread badges live
    const messageChannel = supabase
      .channel("all-messages-unread")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        (payload) => {
          const roomId = payload.new.room_id as string;
          // Increment unread count for the room that got a new message
          setUnreadCounts((prev) => ({
            ...prev,
            [roomId]: (prev[roomId] ?? 0) + 1,
          }));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(memberChannel);
      supabase.removeChannel(messageChannel);
    };
  }, [fetchRooms, supabase]);

  const createRoom = useCallback(
    async (name: string, description: string): Promise<Room | null> => {
      if (!userId) return null;

      const slug = slugify(name);
      const { data: room, error } = await supabase
        .from("rooms")
        .insert({ name, slug, description, created_by: userId })
        .select()
        .single();

      if (error) {
        console.error("Failed to create room:", error.message);
        return null;
      }

      // Auto-join as owner
      await supabase
        .from("room_members")
        .insert({ room_id: room.id, user_id: userId, role: "owner" });

      await fetchRooms();
      return room;
    },
    [userId, supabase, fetchRooms]
  );

  const joinRoom = useCallback(
    async (roomId: string): Promise<boolean> => {
      if (!userId) return false;

      const { error } = await supabase
        .from("room_members")
        .insert({ room_id: roomId, user_id: userId, role: "member" });

      if (error) {
        console.error("Failed to join room:", error.message);
        return false;
      }

      await fetchRooms();
      return true;
    },
    [userId, supabase, fetchRooms]
  );

  const leaveRoom = useCallback(
    async (roomId: string): Promise<boolean> => {
      if (!userId) return false;

      const { error } = await supabase
        .from("room_members")
        .delete()
        .eq("room_id", roomId)
        .eq("user_id", userId);

      if (error) {
        console.error("Failed to leave room:", error.message);
        return false;
      }

      await fetchRooms();
      return true;
    },
    [userId, supabase, fetchRooms]
  );

  return {
    rooms,
    allRooms,
    unreadCounts,
    loading,
    createRoom,
    joinRoom,
    leaveRoom,
    refreshRooms: fetchRooms,
  };
}
