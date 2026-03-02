"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/lib/hooks/useAuth";
import { useRooms } from "@/lib/hooks/useRooms";
import { RoomSidebar } from "@/components/rooms/RoomSidebar";
import { MessageSearch } from "@/components/chat/MessageSearch";
import { usePathname } from "next/navigation";

export default function ChatLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, profile, loading: authLoading, signOut } = useAuth();
  const { rooms, allRooms, unreadCounts, createRoom, joinRoom } = useRooms(user?.id);
  const pathname = usePathname();
  const [showSearch, setShowSearch] = useState(false);

  // Extract active room slug from URL: /chat/general -> "general"
  const activeSlug = pathname.split("/chat/")[1] || undefined;

  // Cmd+K / Ctrl+K shortcut to open search
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "k") {
      e.preventDefault();
      setShowSearch((prev) => !prev);
    }
  }, []);

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  if (authLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-bg-primary text-text-muted">
        Loading...
      </div>
    );
  }

  if (!user || !profile) {
    return null; // Middleware will redirect to login
  }

  return (
    <div className="flex h-screen bg-bg-primary">
      <RoomSidebar
        rooms={rooms}
        allRooms={allRooms}
        unreadCounts={unreadCounts}
        activeSlug={activeSlug}
        username={profile.username}
        onCreateRoom={createRoom}
        onJoinRoom={joinRoom}
        onSignOut={signOut}
        onSearchClick={() => setShowSearch(true)}
      />
      <div className="flex min-h-0 flex-1 flex-col">{children}</div>

      {showSearch && (
        <MessageSearch
          userId={user.id}
          onClose={() => setShowSearch(false)}
        />
      )}
    </div>
  );
}
