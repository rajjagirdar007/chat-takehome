"use client";

import { useState, useEffect } from "react";
import { X, Search } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { getInitial } from "@/lib/utils";
import type { Profile } from "@/lib/types";

interface InviteMemberModalProps {
  roomId: string;
  onClose: () => void;
  onInvite: (roomId: string, targetUserId: string) => Promise<boolean>;
}

export function InviteMemberModal({ roomId, onClose, onInvite }: InviteMemberModalProps) {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [invitingId, setInvitingId] = useState<string | null>(null);
  const supabase = createClient();

  // Close on Escape key
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  useEffect(() => {
    async function fetchNonMembers() {
      // Get current members of the room
      const { data: members } = await supabase
        .from("room_members")
        .select("user_id")
        .eq("room_id", roomId);

      const memberIds = new Set((members ?? []).map((m) => m.user_id));

      // Get all profiles and filter out existing members
      const { data: allProfiles } = await supabase
        .from("profiles")
        .select("*")
        .order("username", { ascending: true });

      if (allProfiles) {
        setProfiles(
          (allProfiles as Profile[]).filter((p) => !memberIds.has(p.id))
        );
      }
      setLoading(false);
    }
    fetchNonMembers();
  }, [roomId, supabase]);

  const filteredProfiles = profiles.filter((profile) =>
    profile.username.toLowerCase().includes(searchQuery.toLowerCase())
  );

  async function handleInvite(profile: Profile) {
    setInvitingId(profile.id);
    const success = await onInvite(roomId, profile.id);
    if (success) {
      // Remove invited user from the list
      setProfiles((prev) => prev.filter((p) => p.id !== profile.id));
    }
    setInvitingId(null);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-lg bg-bg-secondary p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-text-primary">
            Invite Member
          </h3>
          <button
            onClick={onClose}
            className="text-text-muted hover:text-text-primary"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Search input */}
        <div className="relative mb-3">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-text-muted" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded bg-bg-tertiary py-2 pl-9 pr-3 text-sm text-text-primary outline-none focus:ring-2 focus:ring-accent"
            placeholder="Search users..."
            autoFocus
          />
        </div>

        {/* User list */}
        <div className="max-h-64 overflow-y-auto">
          {loading ? (
            <p className="py-4 text-center text-sm text-text-muted">Loading users...</p>
          ) : filteredProfiles.length === 0 ? (
            <p className="py-4 text-center text-sm text-text-muted">
              {searchQuery ? "No users found" : "Everyone is already a member"}
            </p>
          ) : (
            filteredProfiles.map((profile) => (
              <button
                key={profile.id}
                onClick={() => handleInvite(profile)}
                disabled={invitingId === profile.id}
                className="flex w-full items-center gap-3 rounded px-2 py-2 text-left hover:bg-bg-tertiary disabled:opacity-50"
              >
                <div
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white"
                  style={{ backgroundColor: profile.avatar_color }}
                >
                  {getInitial(profile.username)}
                </div>
                <span className="flex-1 text-sm text-text-primary">{profile.username}</span>
                <span className="text-xs text-accent">
                  {invitingId === profile.id ? "Inviting..." : "Invite"}
                </span>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
