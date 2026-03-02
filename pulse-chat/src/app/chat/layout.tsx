"use client";

import { useAuth } from "@/lib/hooks/useAuth";
import { useRooms } from "@/lib/hooks/useRooms";
import { RoomSidebar } from "@/components/rooms/RoomSidebar";
import { usePathname } from "next/navigation";

export default function ChatLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, profile, loading: authLoading, signOut } = useAuth();
  const { rooms, allRooms, createRoom, joinRoom } = useRooms(user?.id);
  const pathname = usePathname();

  // Extract active room slug from URL: /chat/general -> "general"
  const activeSlug = pathname.split("/chat/")[1] || undefined;

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
        activeSlug={activeSlug}
        username={profile.username}
        onCreateRoom={createRoom}
        onJoinRoom={joinRoom}
        onSignOut={signOut}
      />
      <div className="flex flex-1 flex-col">{children}</div>
    </div>
  );
}
