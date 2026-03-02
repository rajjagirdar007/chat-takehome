"use client";

import type { PresenceState } from "@/lib/types";
import { UserAvatar } from "./UserAvatar";

interface MemberListProps {
  onlineUsers: PresenceState[];
}

export function MemberList({ onlineUsers }: MemberListProps) {
  return (
    <div className="hidden w-60 flex-col border-l border-border bg-bg-secondary lg:flex">
      <div className="border-b border-border p-4">
        <h3 className="text-sm font-semibold text-text-secondary">
          Online — {onlineUsers.length}
        </h3>
      </div>
      <div className="flex-1 overflow-y-auto p-2">
        {onlineUsers.map((user) => (
          <div
            key={user.user_id}
            className="flex items-center gap-2 rounded px-2 py-1.5"
          >
            <UserAvatar
              username={user.username}
              color={user.avatar_color}
              size="sm"
              status="online"
            />
            <span className="text-sm text-text-secondary">
              {user.username}
            </span>
            {user.typing && (
              <span className="text-xs italic text-text-muted">typing...</span>
            )}
          </div>
        ))}
        {onlineUsers.length === 0 && (
          <p className="px-2 py-4 text-sm text-text-muted">
            No one else is here yet
          </p>
        )}
      </div>
    </div>
  );
}
