-- ============================================
-- PULSE CHAT — COMPLETE DATABASE SCHEMA
-- Run this entire file in Supabase SQL Editor
-- ============================================

-- 1. PROFILES (extends Supabase auth.users)
CREATE TABLE public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  display_name TEXT,
  avatar_url TEXT,
  avatar_color TEXT DEFAULT '#6366f1',
  status TEXT DEFAULT 'online' CHECK (status IN ('online', 'away', 'offline')),
  last_seen_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, username, display_name, avatar_color)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1)),
    '#' || substr(md5(NEW.id::text), 1, 6)
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 2. ROOMS
CREATE TABLE public.rooms (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  slug TEXT UNIQUE NOT NULL,
  is_direct BOOLEAN DEFAULT false,
  is_private BOOLEAN DEFAULT false,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. ROOM MEMBERS (join table)
CREATE TABLE public.room_members (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  room_id UUID REFERENCES public.rooms(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  role TEXT DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member')),
  last_read_at TIMESTAMPTZ DEFAULT now(),
  joined_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(room_id, user_id)
);

-- 4. MESSAGES
CREATE TABLE public.messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  room_id UUID REFERENCES public.rooms(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  content TEXT NOT NULL,
  type TEXT DEFAULT 'text' CHECK (type IN ('text', 'system', 'image', 'file')),
  metadata JSONB DEFAULT '{}',
  edited_at TIMESTAMPTZ,
  is_deleted BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 5. INDEXES
CREATE INDEX idx_messages_room_id ON public.messages(room_id, created_at DESC);
CREATE INDEX idx_messages_content ON public.messages USING gin(to_tsvector('english', content));
CREATE INDEX idx_room_members_user ON public.room_members(user_id);
CREATE INDEX idx_room_members_room ON public.room_members(room_id);
CREATE INDEX idx_rooms_slug ON public.rooms(slug);

-- 6. ROW LEVEL SECURITY
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.room_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- Profiles: anyone can read, only own profile editable
CREATE POLICY "Profiles are viewable by everyone" ON public.profiles
  FOR SELECT USING (true);
CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

-- Rooms: anyone authenticated can read and create
CREATE POLICY "Rooms are viewable by authenticated users" ON public.rooms
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can create rooms" ON public.rooms
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);

-- Room members: can read members of rooms you're in, can join rooms
CREATE POLICY "Can view members of any room" ON public.room_members
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Can join rooms" ON public.room_members
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Can leave rooms" ON public.room_members
  FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Can update own membership" ON public.room_members
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);

-- Messages: can read messages in rooms you're a member of, can send to rooms you're in
CREATE POLICY "Can view messages in joined rooms" ON public.messages
  FOR SELECT TO authenticated
  USING (
    room_id IN (SELECT room_id FROM public.room_members WHERE user_id = auth.uid())
  );
CREATE POLICY "Can send messages to joined rooms" ON public.messages
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id AND
    room_id IN (SELECT room_id FROM public.room_members WHERE user_id = auth.uid())
  );
CREATE POLICY "Can soft-delete own messages" ON public.messages
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

-- 7. ENABLE REALTIME
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.room_members;
ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;

-- 8. SEED DEFAULT ROOMS (uses a null created_by since no user exists yet)
INSERT INTO public.rooms (name, slug, description, created_by) VALUES
  ('general', 'general', 'General discussion', NULL),
  ('random', 'random', 'Off-topic chat', NULL),
  ('introductions', 'introductions', 'Say hello!', NULL);

-- 9. FUNCTION: Auto-join new users to #general
CREATE OR REPLACE FUNCTION public.auto_join_general()
RETURNS TRIGGER AS $$
DECLARE
  general_room_id UUID;
BEGIN
  SELECT id INTO general_room_id FROM public.rooms WHERE slug = 'general' LIMIT 1;
  IF general_room_id IS NOT NULL THEN
    INSERT INTO public.room_members (room_id, user_id, role)
    VALUES (general_room_id, NEW.id, 'member')
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_profile_created_join_general
  AFTER INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.auto_join_general();

-- 10. SEARCH FUNCTION (full-text search across joined rooms)
CREATE OR REPLACE FUNCTION search_messages(query text, user_uuid uuid)
RETURNS TABLE (
  id UUID,
  room_id UUID,
  user_id UUID,
  content TEXT,
  type TEXT,
  created_at TIMESTAMPTZ,
  room_name TEXT,
  room_slug TEXT,
  username TEXT,
  avatar_color TEXT
) AS $$
  SELECT
    m.id, m.room_id, m.user_id, m.content, m.type, m.created_at,
    r.name AS room_name, r.slug AS room_slug,
    p.username, p.avatar_color
  FROM public.messages m
  JOIN public.rooms r ON r.id = m.room_id
  LEFT JOIN public.profiles p ON p.id = m.user_id
  WHERE
    m.room_id IN (SELECT rm.room_id FROM public.room_members rm WHERE rm.user_id = user_uuid)
    AND m.is_deleted = false
    AND to_tsvector('english', m.content) @@ plainto_tsquery('english', query)
  ORDER BY m.created_at DESC
  LIMIT 20;
$$ LANGUAGE sql SECURITY DEFINER;
