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
import { Hash } from "lucide-react";
import type { Room } from "@/lib/types";

export default function RoomPage() {
  const params = useParams();
  const roomSlug = params.roomSlug as string;
  const { user, profile } = useAuth();
  const [room, setRoom] = useState<Room | null>(null);
  const [roomLoading, setRoomLoading] = useState(true);
  const supabase = createClient();

  // Fetch room by slug
  useEffect(() => {
    async function fetchRoom() {
      setRoomLoading(true);
      const { data } = await supabase
        .from("rooms")
        .select("*")
        .eq("slug", roomSlug)
        .single();
      setRoom(data);
      setRoomLoading(false);
    }
    fetchRoom();
  }, [roomSlug, supabase]);

  const { messages, loading: messagesLoading, sendMessage, loadMore, hasMore } =
    useMessages(room?.id, user?.id);

  // Memoize the currentUser object to prevent infinite re-renders in usePresence
  const currentUser = useMemo(() => {
    if (!profile) return null;
    return {
      id: profile.id,
      username: profile.username,
      avatar_color: profile.avatar_color,
    };
  }, [profile]);

  const { onlineUsers, typingUsers, setTyping } = usePresence(
    room?.id,
    currentUser
  );

  // Update last_read_at when viewing the room
  useEffect(() => {
    if (!room?.id || !user?.id) return;
    supabase
      .from("room_members")
      .update({ last_read_at: new Date().toISOString() })
      .eq("room_id", room.id)
      .eq("user_id", user.id)
      .then(() => {});
  }, [room?.id, user?.id, messages.length, supabase]);

  if (roomLoading) {
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

  return (
    <div className="flex flex-1">
      {/* Main chat area */}
      <div className="flex flex-1 flex-col">
        {/* Room header */}
        <div className="flex items-center gap-2 border-b border-border bg-bg-secondary px-4 py-3">
          <Hash className="h-5 w-5 text-text-muted" />
          <h2 className="font-semibold text-text-primary">{room.name}</h2>
          {room.description && (
            <>
              <span className="text-text-muted">|</span>
              <span className="text-sm text-text-muted">
                {room.description}
              </span>
            </>
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
        <MessageInput onSend={sendMessage} onTyping={setTyping} />
      </div>

      {/* Member list (right sidebar) */}
      <MemberList onlineUsers={onlineUsers} />
    </div>
  );
}
