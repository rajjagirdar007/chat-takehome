"use client";

import { useEffect, useState, useMemo } from "react";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/lib/hooks/useAuth";
import { useMessages } from "@/lib/hooks/useMessages";
import { usePresence } from "@/lib/hooks/usePresence";
import { MessageList } from "@/components/chat/MessageList";
import { MessageInput } from "@/components/chat/MessageInput";
import { TypingIndicator } from "@/components/chat/TypingIndicator";
import { MemberList } from "@/components/users/MemberList";
import { InviteMemberModal } from "@/components/rooms/InviteMemberModal";
import { Hash, Lock, UserPlus, ShieldAlert } from "lucide-react";
import type { Room, RoomMember } from "@/lib/types";

export default function RoomPage() {
  const params = useParams();
  const roomSlug = params.roomSlug as string;
  const { user, profile } = useAuth();
  const [room, setRoom] = useState<Room | null>(null);
  const [roomLoading, setRoomLoading] = useState(true);
  const [membership, setMembership] = useState<RoomMember | null>(null);
  const [membershipChecked, setMembershipChecked] = useState(false);
  const [dmPartnerName, setDmPartnerName] = useState<string | null>(null);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const supabase = createClient();

  // Fetch room by slug, then check membership in one sequential flow.
  // This avoids the race condition where membership check completes before room fetch.
  useEffect(() => {
    let cancelled = false;

    async function fetchRoomAndMembership() {
      setRoomLoading(true);
      setMembershipChecked(false);

      // maybeSingle: returns null for 0 rows instead of 406 error
      const { data: roomData } = await supabase
        .from("rooms")
        .select("*")
        .eq("slug", roomSlug)
        .maybeSingle();

      if (cancelled) return;
      setRoom(roomData);

      // Check membership if room exists and user is logged in
      if (roomData && user?.id) {
        const { data: memberData } = await supabase
          .from("room_members")
          .select("*")
          .eq("room_id", roomData.id)
          .eq("user_id", user.id)
          .maybeSingle();

        if (cancelled) return;
        setMembership(memberData as RoomMember | null);

        // For DMs, resolve the partner's display name from the slug
        if (roomData.is_direct) {
          const parts = roomData.slug.split("--");
          if (parts.length === 3) {
            const partnerId = parts[1] === user.id ? parts[2] : parts[1];
            const { data: partnerProfile } = await supabase
              .from("profiles")
              .select("username")
              .eq("id", partnerId)
              .maybeSingle();

            if (!cancelled && partnerProfile) {
              setDmPartnerName(partnerProfile.username);
            }
          }
        }
      }

      if (!cancelled) {
        setMembershipChecked(true);
        setRoomLoading(false);
      }
    }

    fetchRoomAndMembership();
    return () => { cancelled = true; };
  }, [roomSlug, user?.id, supabase]);

  const isPrivateOrDm = room?.is_private || room?.is_direct;
  const isMember = membership !== null;
  const canInvite = membership?.role === "owner" || membership?.role === "admin";

  // Only load messages/presence if the user has access
  const roomIdForData = isPrivateOrDm && !isMember ? undefined : room?.id;

  const { messages, loading: messagesLoading, sendMessage, sendFileMessage, loadMore, hasMore } =
    useMessages(roomIdForData, user?.id);

  const currentUser = useMemo(() => {
    if (!profile) return null;
    return {
      id: profile.id,
      username: profile.username,
      avatar_color: profile.avatar_color,
    };
  }, [profile]);

  const { onlineUsers, typingUsers, setTyping } = usePresence(
    roomIdForData,
    currentUser
  );

  // Update last_read_at when viewing the room
  useEffect(() => {
    if (!room?.id || !user?.id || !isMember) return;
    supabase
      .from("room_members")
      .update({ last_read_at: new Date().toISOString() })
      .eq("room_id", room.id)
      .eq("user_id", user.id)
      .then(() => {});
  }, [room?.id, user?.id, messages.length, supabase, isMember]);

  /** Invite a user directly via Supabase — avoids a second useRooms instance. */
  async function handleInvite(roomId: string, targetUserId: string): Promise<boolean> {
    const { error } = await supabase
      .from("room_members")
      .insert({ room_id: roomId, user_id: targetUserId, role: "member" });

    if (error) {
      console.error("Failed to invite member:", error.message);
      return false;
    }
    return true;
  }

  if (roomLoading || !membershipChecked) {
    return (
      <div className="flex flex-1 items-center justify-center text-text-muted">
        Loading room...
      </div>
    );
  }

  if (!room) {
    return (
      <div className="flex flex-1 items-center justify-center text-text-muted">
        Room not found
      </div>
    );
  }

  // Access guard: non-members can't see private/DM rooms
  if (isPrivateOrDm && !isMember) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 text-text-muted">
        <ShieldAlert className="h-10 w-10" />
        <p className="text-lg font-medium">This is a private channel</p>
        <p className="text-sm">You need an invitation to view this room.</p>
      </div>
    );
  }

  const headerIcon = room.is_direct ? null : room.is_private ? (
    <Lock className="h-5 w-5 text-text-muted" />
  ) : (
    <Hash className="h-5 w-5 text-text-muted" />
  );

  const headerName = room.is_direct
    ? `@ ${dmPartnerName ?? room.name}`
    : room.name;

  return (
    <div className="flex min-h-0 flex-1">
      {/* Main chat area */}
      <div className="flex min-h-0 flex-1 flex-col">
        {/* Room header */}
        <div className="flex items-center gap-2 border-b border-border bg-bg-secondary px-4 py-3">
          {headerIcon}
          <h2 className="font-semibold text-text-primary">{headerName}</h2>
          {room.description && !room.is_direct && (
            <>
              <span className="text-text-muted">|</span>
              <span className="text-sm text-text-muted">
                {room.description}
              </span>
            </>
          )}
          {/* Invite button for private channels (not DMs) when user is owner/admin */}
          {room.is_private && !room.is_direct && canInvite && (
            <button
              onClick={() => setShowInviteModal(true)}
              className="ml-auto flex items-center gap-1 rounded px-2 py-1 text-xs text-text-muted hover:bg-bg-tertiary hover:text-text-primary"
              title="Invite member"
            >
              <UserPlus className="h-4 w-4" />
              Invite
            </button>
          )}
        </div>

        {/* Messages */}
        <MessageList
          messages={messages}
          currentUserId={user?.id}
          loading={messagesLoading}
          hasMore={hasMore}
          onLoadMore={loadMore}
        />

        {/* Typing indicator */}
        <TypingIndicator typingUsers={typingUsers} />

        {/* Message input */}
        <MessageInput onSend={sendMessage} onSendFile={sendFileMessage} onTyping={setTyping} />
      </div>

      {/* Member list (right sidebar) */}
      <MemberList onlineUsers={onlineUsers} />

      {/* Invite modal */}
      {showInviteModal && room && (
        <InviteMemberModal
          roomId={room.id}
          onClose={() => setShowInviteModal(false)}
          onInvite={handleInvite}
        />
      )}
    </div>
  );
}
