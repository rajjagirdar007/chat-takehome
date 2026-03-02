export interface Profile {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  avatar_color: string;
  status: "online" | "away" | "offline";
  last_seen_at: string;
  created_at: string;
}

export interface Room {
  id: string;
  name: string;
  description: string;
  slug: string;
  is_direct: boolean;
  created_by: string | null;
  created_at: string;
}

export interface RoomMember {
  id: string;
  room_id: string;
  user_id: string;
  role: "owner" | "admin" | "member";
  last_read_at: string;
  joined_at: string;
}

export interface Message {
  id: string;
  room_id: string;
  user_id: string | null;
  content: string;
  type: "text" | "system" | "image" | "file";
  metadata: Record<string, unknown>;
  edited_at: string | null;
  is_deleted: boolean;
  created_at: string;
}

// Message with joined profile data (from Supabase query with select + join)
export interface MessageWithProfile extends Message {
  profiles: Pick<Profile, "username" | "avatar_color"> | null;
}

// Room membership with joined room data
export interface RoomMemberWithRoom extends RoomMember {
  rooms: Room;
}

// Presence state tracked via Supabase Realtime
export interface PresenceState {
  user_id: string;
  username: string;
  avatar_color: string;
  online_at: string;
  typing: boolean;
}
