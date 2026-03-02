-- ============================================
-- PULSE CHAT — API MIGRATION
-- Run this in Supabase SQL Editor after the base schema
-- Adds: is_private on rooms, external_id on messages, automation_tokens table
-- ============================================

-- 1. ADD is_private TO ROOMS (if not already present)
-- Marks invite-only rooms; app code already uses this field
ALTER TABLE public.rooms ADD COLUMN IF NOT EXISTS is_private BOOLEAN DEFAULT false;

-- 2. ADD external_id TO MESSAGES (for idempotent automation)
-- Allows automation to retry without creating duplicate messages
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS external_id TEXT;

-- Partial unique index: only enforced when external_id is not null
-- This means normal UI messages (null external_id) are unaffected
CREATE UNIQUE INDEX IF NOT EXISTS idx_messages_external_id_room
  ON public.messages(room_id, external_id) WHERE external_id IS NOT NULL;

-- 3. AUTOMATION TOKENS TABLE
-- Server-side tokens for n8n, cURL, and other automation integrations
CREATE TABLE IF NOT EXISTS public.automation_tokens (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  -- SHA-256 hash of the bearer token; plaintext is never stored
  token_hash TEXT UNIQUE NOT NULL,
  is_active BOOLEAN DEFAULT true,
  -- Scope: if allow_all_rooms is false, only allowed_room_ids are permitted
  allow_all_rooms BOOLEAN DEFAULT true,
  allowed_room_ids UUID[] DEFAULT '{}',
  -- Optional: attribute messages to a specific user instead of system
  actor_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  -- Permission flags
  can_send_notifications BOOLEAN DEFAULT true,
  can_send_messages BOOLEAN DEFAULT false,
  -- Audit fields
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- No RLS on automation_tokens — only accessed server-side via service role key
-- RLS is NOT enabled; this table is never exposed to the client

-- 4. RLS POLICY: Allow messages with null user_id (system/automation messages)
-- The existing insert policy requires auth.uid() = user_id, which blocks
-- service-role inserts with null user_id. Service role bypasses RLS entirely,
-- so no policy change needed — but we document it here for clarity.

-- 5. HELPER: Generate a token and insert its hash
-- Run this manually to create a token. Save the plaintext output — it won't be stored.
--
-- Example (run in SQL editor):
--   SELECT encode(gen_random_bytes(32), 'hex') AS plaintext_token;
--   -- Copy the output, then hash it as a UTF-8 string (must match JS SHA-256):
--   INSERT INTO public.automation_tokens (name, token_hash)
--   VALUES ('n8n-prod', encode(sha256('YOUR_PLAINTEXT_TOKEN_HERE'::bytea), 'hex'));
--
-- IMPORTANT: Use 'token_string'::bytea (casts UTF-8 string to bytes).
-- Do NOT use decode('...', 'hex') — that interprets the token as hex-encoded
-- binary, which produces a different hash than the JS API route expects.
