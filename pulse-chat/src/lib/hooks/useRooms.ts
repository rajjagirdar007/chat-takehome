"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Room, RoomMemberWithRoom } from "@/lib/types";
import { slugify } from "@/lib/utils";

interface UseRoomsReturn {
  rooms: RoomMemberWithRoom[];
  allRooms: Room[];
  loading: boolean;
  createRoom: (name: string, description: string) => Promise<Room | null>;
  joinRoom: (roomId: string) => Promise<boolean>;
  leaveRoom: (roomId: string) => Promise<boolean>;
  refreshRooms: () => Promise<void>;
}

export function useRooms(userId: string | undefined): UseRoomsReturn {
  const [rooms, setRooms] = useState<RoomMemberWithRoom[]>([]);
  const [allRooms, setAllRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  const fetchRooms = useCallback(async () => {
    if (!userId) return;

    // Fetch rooms user is a member of
    const { data: memberRooms } = await supabase
      .from("room_members")
      .select("*, rooms(*)")
      .eq("user_id", userId);

    if (memberRooms) {
      setRooms(memberRooms as RoomMemberWithRoom[]);
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
  }, [userId, supabase]);

  useEffect(() => {
    fetchRooms();

    // Subscribe to room_members changes for live updates
    const channel = supabase
      .channel("room-members-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "room_members" },
        () => {
          fetchRooms();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
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
    loading,
    createRoom,
    joinRoom,
    leaveRoom,
    refreshRooms: fetchRooms,
  };
}
