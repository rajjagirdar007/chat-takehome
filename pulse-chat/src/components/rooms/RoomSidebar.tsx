"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Hash, Plus, LogOut, Search, Lock } from "lucide-react";
import type { RoomMemberWithRoom, Room } from "@/lib/types";
import { CreateRoomModal } from "./CreateRoomModal";
import { NewDmModal } from "./NewDmModal";

interface RoomSidebarProps {
  rooms: RoomMemberWithRoom[];
  allRooms: Room[];
  unreadCounts: Record<string, number>;
  dmPartnerNames: Record<string, string>;
  activeSlug: string | undefined;
  username: string;
  currentUserId: string;
  onCreateRoom: (name: string, description: string, isPrivate?: boolean) => Promise<Room | null>;
  onJoinRoom: (roomId: string) => Promise<boolean>;
  onCreateOrGetDm: (otherUserId: string, otherUsername: string) => Promise<Room | null>;
  onSignOut: () => Promise<void>;
  onSearchClick: () => void;
}

export function RoomSidebar({
  rooms,
  allRooms,
  unreadCounts,
  dmPartnerNames,
  activeSlug,
  username,
  currentUserId,
  onCreateRoom,
  onJoinRoom,
  onCreateOrGetDm,
  onSignOut,
  onSearchClick,
}: RoomSidebarProps) {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDmModal, setShowDmModal] = useState(false);
  const router = useRouter();

  // Split joined rooms into channels and DMs
  const channels = rooms.filter((r) => !r.rooms.is_direct);
  const dms = rooms.filter((r) => r.rooms.is_direct);

  const joinedRoomIds = new Set(rooms.map((r) => r.rooms.id));
  // allRooms is already filtered to public, non-direct by the hook
  const unjoinedRooms = allRooms.filter((r) => !joinedRoomIds.has(r.id));

  // Compute partner IDs from existing DMs so the modal can filter them out
  const existingDmPartnerIds = new Set<string>();
  for (const dm of dms) {
    const parts = dm.rooms.slug.split("--");
    if (parts.length === 3) {
      const partnerId = parts[1] === currentUserId ? parts[2] : parts[1];
      existingDmPartnerIds.add(partnerId);
    }
  }

  return (
    <div className="flex h-full w-64 flex-col bg-bg-secondary">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border p-4">
        <h2 className="text-lg font-bold text-text-primary">Pulse Chat</h2>
        <button
          onClick={onSearchClick}
          className="text-text-muted hover:text-text-primary"
          title="Search messages (Cmd+K)"
        >
          <Search className="h-4 w-4" />
        </button>
      </div>

      {/* Room lists */}
      <div className="flex-1 overflow-y-auto p-2">
        {/* Channels section */}
        <div className="mb-2 flex items-center justify-between px-2">
          <p className="text-xs font-semibold uppercase text-text-muted">
            Channels
          </p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="text-text-muted hover:text-text-primary"
            title="Create channel"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        </div>
        {channels.map((membership) => {
          const unread = unreadCounts[membership.room_id] ?? 0;
          const isActive = activeSlug === membership.rooms.slug;
          const icon = membership.rooms.is_private
            ? <Lock className="h-4 w-4 shrink-0" />
            : <Hash className="h-4 w-4 shrink-0" />;

          return (
            <button
              key={membership.rooms.id}
              onClick={() => router.push(`/chat/${membership.rooms.slug}`)}
              className={`flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm ${
                isActive
                  ? "bg-bg-hover text-text-primary"
                  : unread > 0
                    ? "font-semibold text-text-primary hover:bg-bg-tertiary"
                    : "text-text-secondary hover:bg-bg-tertiary"
              }`}
            >
              {icon}
              <span className="flex-1 truncate">{membership.rooms.name}</span>
              {unread > 0 && !isActive && (
                <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-unread px-1.5 text-xs font-bold text-white">
                  {unread > 99 ? "99+" : unread}
                </span>
              )}
            </button>
          );
        })}

        {/* Direct Messages section */}
        <div className="mb-2 mt-4 flex items-center justify-between px-2">
          <p className="text-xs font-semibold uppercase text-text-muted">
            Direct Messages
          </p>
          <button
            onClick={() => setShowDmModal(true)}
            className="text-text-muted hover:text-text-primary"
            title="New message"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        </div>
        {dms.length === 0 ? (
          <p className="px-2 text-xs text-text-muted">No conversations yet</p>
        ) : (
          dms.map((membership) => {
            const unread = unreadCounts[membership.room_id] ?? 0;
            const isActive = activeSlug === membership.rooms.slug;
            // Use resolved partner name so both users see the correct display name
            const displayName = dmPartnerNames[membership.room_id] ?? membership.rooms.name;

            return (
              <button
                key={membership.rooms.id}
                onClick={() => router.push(`/chat/${membership.rooms.slug}`)}
                className={`flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm ${
                  isActive
                    ? "bg-bg-hover text-text-primary"
                    : unread > 0
                      ? "font-semibold text-text-primary hover:bg-bg-tertiary"
                      : "text-text-secondary hover:bg-bg-tertiary"
                }`}
              >
                <span className="flex h-4 w-4 shrink-0 items-center justify-center text-xs text-text-muted">
                  @
                </span>
                <span className="flex-1 truncate">{displayName}</span>
                {unread > 0 && !isActive && (
                  <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-unread px-1.5 text-xs font-bold text-white">
                    {unread > 99 ? "99+" : unread}
                  </span>
                )}
              </button>
            );
          })
        )}

        {/* Browse public rooms */}
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
          onCreate={async (name, description, isPrivate) => {
            const room = await onCreateRoom(name, description, isPrivate);
            if (room) {
              setShowCreateModal(false);
              router.push(`/chat/${room.slug}`);
            }
          }}
        />
      )}

      {showDmModal && (
        <NewDmModal
          currentUserId={currentUserId}
          existingDmPartnerIds={existingDmPartnerIds}
          onClose={() => setShowDmModal(false)}
          onSelectUser={async (userId, dmUsername) => {
            const room = await onCreateOrGetDm(userId, dmUsername);
            if (room) {
              setShowDmModal(false);
              router.push(`/chat/${room.slug}`);
            }
            return room;
          }}
        />
      )}
    </div>
  );
}
