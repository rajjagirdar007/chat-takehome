"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Room, RoomMemberWithRoom } from "@/lib/types";
import { slugify, createDmSlug } from "@/lib/utils";

interface UseRoomsReturn {
  rooms: RoomMemberWithRoom[];
  allRooms: Room[];
  unreadCounts: Record<string, number>;
  /** Maps room_id → partner's username for DMs (so both users see the correct name) */
  dmPartnerNames: Record<string, string>;
  loading: boolean;
  createRoom: (name: string, description: string, isPrivate?: boolean) => Promise<Room | null>;
  joinRoom: (roomId: string) => Promise<boolean>;
  leaveRoom: (roomId: string) => Promise<boolean>;
  createOrGetDm: (otherUserId: string, otherUsername: string) => Promise<Room | null>;
  inviteMember: (roomId: string, targetUserId: string) => Promise<boolean>;
  refreshRooms: () => Promise<void>;
}

export function useRooms(userId: string | undefined): UseRoomsReturn {
  const [rooms, setRooms] = useState<RoomMemberWithRoom[]>([]);
  const [allRooms, setAllRooms] = useState<Room[]>([]);
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});
  const [dmPartnerNames, setDmPartnerNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  const fetchUnreadCounts = useCallback(
    async (memberships: RoomMemberWithRoom[]) => {
      const counts: Record<string, number> = {};

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

  /**
   * For DM rooms, the stored name only reflects one user's perspective.
   * Parse the deterministic slug to find the partner's ID, then batch-fetch their usernames.
   */
  const resolveDmPartnerNames = useCallback(
    async (memberships: RoomMemberWithRoom[], currentUserId: string) => {
      const dmRooms = memberships.filter((m) => m.rooms.is_direct);
      if (dmRooms.length === 0) {
        setDmPartnerNames({});
        return;
      }

      // Extract partner IDs from deterministic slugs: dm--uuid1--uuid2
      const partnerIdsByRoomId: Record<string, string> = {};
      const partnerIds: string[] = [];

      for (const dm of dmRooms) {
        const parts = dm.rooms.slug.split("--");
        if (parts.length === 3) {
          const partnerId = parts[1] === currentUserId ? parts[2] : parts[1];
          partnerIdsByRoomId[dm.room_id] = partnerId;
          partnerIds.push(partnerId);
        }
      }

      if (partnerIds.length === 0) return;

      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, username")
        .in("id", partnerIds);

      const profileMap = new Map(
        (profiles ?? []).map((p: { id: string; username: string }) => [p.id, p.username])
      );

      const names: Record<string, string> = {};
      for (const [roomId, partnerId] of Object.entries(partnerIdsByRoomId)) {
        names[roomId] = profileMap.get(partnerId) ?? "Unknown";
      }

      setDmPartnerNames(names);
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
      resolveDmPartnerNames(typed, userId);
    }

    // Fetch browsable rooms: only public, non-DM rooms
    const { data: all } = await supabase
      .from("rooms")
      .select("*")
      .eq("is_private", false)
      .eq("is_direct", false)
      .order("created_at", { ascending: true });

    if (all) {
      setAllRooms(all);
    }

    setLoading(false);
  }, [userId, supabase, fetchUnreadCounts, resolveDmPartnerNames]);

  useEffect(() => {
    fetchRooms();

    // Filter to current user's memberships for reliable CDC delivery
    const memberChannel = supabase
      .channel("room-members-changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "room_members",
          filter: userId ? `user_id=eq.${userId}` : undefined,
        },
        () => {
          fetchRooms();
        }
      )
      .subscribe();

    // Subscribe to new messages for unread badge updates
    const messageChannel = supabase
      .channel("all-messages-unread")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        (payload) => {
          const roomId = payload.new.room_id as string;
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
  }, [fetchRooms, supabase, userId]);

  const createRoom = useCallback(
    async (name: string, description: string, isPrivate = false): Promise<Room | null> => {
      if (!userId) return null;

      const slug = slugify(name);
      const { data: room, error } = await supabase
        .from("rooms")
        .insert({ name, slug, description, created_by: userId, is_private: isPrivate })
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

  /** Find existing DM or create a new one. Uses deterministic slug so DMs are never duplicated. */
  const createOrGetDm = useCallback(
    async (otherUserId: string, otherUsername: string): Promise<Room | null> => {
      if (!userId) return null;

      const slug = createDmSlug(userId, otherUserId);

      // Primary lookup: search through our own memberships. This works regardless
      // of rooms-table RLS because users can always SELECT their own room_members rows.
      const { data: myMemberships } = await supabase
        .from("room_members")
        .select("rooms(*)")
        .eq("user_id", userId);

      // Supabase returns rooms as a nested object for many-to-one foreign keys,
      // but its TS types infer an array. Cast through unknown to correct this.
      const typedMemberships = (myMemberships ?? []) as unknown as Array<{ rooms: Room }>;
      const existingViaMembers = typedMemberships.find((m) => m.rooms?.slug === slug);

      if (existingViaMembers?.rooms) {
        return existingViaMembers.rooms;
      }

      // Fallback: direct rooms lookup (handles case where room exists but user isn't a member)
      const { data: existingRoom } = await supabase
        .from("rooms")
        .select("*")
        .eq("slug", slug)
        .maybeSingle();

      if (existingRoom) {
        // Self-heal: ensure both users are members
        await supabase
          .from("room_members")
          .insert({ room_id: existingRoom.id, user_id: userId, role: "owner" });

        const { data: otherMembership } = await supabase
          .from("room_members")
          .select("id")
          .eq("room_id", existingRoom.id)
          .eq("user_id", otherUserId)
          .maybeSingle();

        if (!otherMembership) {
          await supabase
            .from("room_members")
            .insert({ room_id: existingRoom.id, user_id: otherUserId, role: "member" });
        }

        await fetchRooms();
        return existingRoom as Room;
      }

      // No existing DM found — create a new one
      const { data: room, error } = await supabase
        .from("rooms")
        .insert({
          name: otherUsername,
          slug,
          description: "",
          is_direct: true,
          is_private: true,
          created_by: userId,
        })
        .select()
        .single();

      if (error) {
        console.error("Failed to create DM:", error.message);
        return null;
      }

      // Insert self first so RLS can verify ownership when inserting the other user.
      // A batch insert would fail because row 2's EXISTS check can't see row 1
      // within the same transaction.
      const { error: selfError } = await supabase
        .from("room_members")
        .insert({ room_id: room.id, user_id: userId, role: "owner" });

      if (selfError) {
        console.error("Failed to join DM as owner:", selfError.message);
        return null;
      }

      const { error: otherError } = await supabase
        .from("room_members")
        .insert({ room_id: room.id, user_id: otherUserId, role: "member" });

      if (otherError) {
        console.error("Failed to add DM partner:", otherError.message);
      }

      await fetchRooms();
      return room as Room;
    },
    [userId, supabase, fetchRooms]
  );

  /** Invite a user to a room. RLS allows this when caller is owner/admin. */
  const inviteMember = useCallback(
    async (roomId: string, targetUserId: string): Promise<boolean> => {
      if (!userId) return false;

      const { error } = await supabase
        .from("room_members")
        .insert({ room_id: roomId, user_id: targetUserId, role: "member" });

      if (error) {
        console.error("Failed to invite member:", error.message);
        return false;
      }

      return true;
    },
    [userId, supabase]
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
    dmPartnerNames,
    loading,
    createRoom,
    joinRoom,
    leaveRoom,
    createOrGetDm,
    inviteMember,
    refreshRooms: fetchRooms,
  };
}
