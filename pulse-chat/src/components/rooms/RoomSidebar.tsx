"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Hash, Plus, LogOut } from "lucide-react";
import type { RoomMemberWithRoom, Room } from "@/lib/types";
import { CreateRoomModal } from "./CreateRoomModal";

interface RoomSidebarProps {
  rooms: RoomMemberWithRoom[];
  allRooms: Room[];
  activeSlug: string | undefined;
  username: string;
  onCreateRoom: (name: string, description: string) => Promise<Room | null>;
  onJoinRoom: (roomId: string) => Promise<boolean>;
  onSignOut: () => Promise<void>;
}

export function RoomSidebar({
  rooms,
  allRooms,
  activeSlug,
  username,
  onCreateRoom,
  onJoinRoom,
  onSignOut,
}: RoomSidebarProps) {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const router = useRouter();

  const joinedRoomIds = new Set(rooms.map((r) => r.rooms.id));
  const unjoinedRooms = allRooms.filter((r) => !joinedRoomIds.has(r.id));

  return (
    <div className="flex h-full w-64 flex-col bg-bg-secondary">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border p-4">
        <h2 className="text-lg font-bold text-text-primary">Pulse Chat</h2>
      </div>

      {/* Joined rooms */}
      <div className="flex-1 overflow-y-auto p-2">
        <p className="mb-2 px-2 text-xs font-semibold uppercase text-text-muted">
          Rooms
        </p>
        {rooms.map((membership) => (
          <button
            key={membership.rooms.id}
            onClick={() => router.push(`/chat/${membership.rooms.slug}`)}
            className={`flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm ${
              activeSlug === membership.rooms.slug
                ? "bg-bg-hover text-text-primary"
                : "text-text-secondary hover:bg-bg-tertiary"
            }`}
          >
            <Hash className="h-4 w-4 shrink-0" />
            {membership.rooms.name}
          </button>
        ))}

        {/* Browse other rooms */}
        {unjoinedRooms.length > 0 && (
          <>
            <p className="mb-2 mt-4 px-2 text-xs font-semibold uppercase text-text-muted">
              Browse
            </p>
            {unjoinedRooms.map((room) => (
              <button
                key={room.id}
                onClick={async () => {
                  const success = await onJoinRoom(room.id);
                  if (success) router.push(`/chat/${room.slug}`);
                }}
                className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm text-text-muted hover:bg-bg-tertiary hover:text-text-secondary"
              >
                <Hash className="h-4 w-4 shrink-0" />
                {room.name}
                <span className="ml-auto text-xs">Join</span>
              </button>
            ))}
          </>
        )}
      </div>

      {/* Create room button */}
      <button
        onClick={() => setShowCreateModal(true)}
        className="mx-2 mb-2 flex items-center gap-2 rounded px-2 py-1.5 text-sm text-text-secondary hover:bg-bg-tertiary"
      >
        <Plus className="h-4 w-4" />
        Create Room
      </button>

      {/* User footer */}
      <div className="flex items-center justify-between border-t border-border p-3">
        <span className="text-sm font-medium text-text-primary">
          {username}
        </span>
        <button
          onClick={onSignOut}
          className="text-text-muted hover:text-text-primary"
          title="Sign out"
        >
          <LogOut className="h-4 w-4" />
        </button>
      </div>

      {showCreateModal && (
        <CreateRoomModal
          onClose={() => setShowCreateModal(false)}
          onCreate={async (name, description) => {
            const room = await onCreateRoom(name, description);
            if (room) {
              setShowCreateModal(false);
              router.push(`/chat/${room.slug}`);
            }
          }}
        />
      )}
    </div>
  );
}
