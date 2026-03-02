import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { hashToken, generateToken } from "@/lib/hash";

/**
 * GET /api/v1/automation/tokens
 * Lists all tokens for the logged-in user (hides the actual token_hash).
 * Requires Supabase session auth (cookie-based, from the browser).
 */
export async function GET(): Promise<NextResponse> {
  const supabaseAuth = await createClient();
  const { data: { user } } = await supabaseAuth.auth.getUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "Not authenticated" }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data: tokens, error } = await admin
    .from("automation_tokens")
    .select("id, name, is_active, allow_all_rooms, allowed_room_ids, can_send_notifications, can_send_messages, last_used_at, created_at")
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ ok: false, error: "Failed to fetch tokens" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, tokens });
}

/**
 * POST /api/v1/automation/tokens
 * Creates a new automation token. Returns the plaintext token ONCE.
 * Requires Supabase session auth.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const supabaseAuth = await createClient();
  const { data: { user } } = await supabaseAuth.auth.getUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "Not authenticated" }, { status: 401 });
  }

  let body: { name?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const name = body.name?.trim();
  if (!name || name.length === 0) {
    return NextResponse.json({ ok: false, error: "name is required" }, { status: 422 });
  }
  if (name.length > 100) {
    return NextResponse.json({ ok: false, error: "name must be under 100 characters" }, { status: 422 });
  }

  const plaintext = generateToken();
  const hash = await hashToken(plaintext);

  const admin = createAdminClient();
  const { data: token, error } = await admin
    .from("automation_tokens")
    .insert({
      name,
      token_hash: hash,
      is_active: true,
      allow_all_rooms: true,
      can_send_notifications: true,
      can_send_messages: false,
    })
    .select("id, name, is_active, created_at")
    .single();

  if (error) {
    console.error("Token creation failed:", error);
    return NextResponse.json({ ok: false, error: "Failed to create token" }, { status: 500 });
  }

  // Return the plaintext token exactly once — it's never stored or retrievable again
  return NextResponse.json(
    {
      ok: true,
      token: {
        ...token,
        plaintext,
      },
    },
    { status: 201 }
  );
}

/**
 * DELETE /api/v1/automation/tokens
 * Deletes a token by ID. Requires Supabase session auth.
 * Body: { id: "uuid" }
 */
export async function DELETE(request: NextRequest): Promise<NextResponse> {
  const supabaseAuth = await createClient();
  const { data: { user } } = await supabaseAuth.auth.getUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "Not authenticated" }, { status: 401 });
  }

  let body: { id?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.id) {
    return NextResponse.json({ ok: false, error: "id is required" }, { status: 422 });
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("automation_tokens")
    .delete()
    .eq("id", body.id);

  if (error) {
    return NextResponse.json({ ok: false, error: "Failed to delete token" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

/**
 * PATCH /api/v1/automation/tokens
 * Toggle a token's is_active status. Requires Supabase session auth.
 * Body: { id: "uuid", is_active: boolean }
 */
export async function PATCH(request: NextRequest): Promise<NextResponse> {
  const supabaseAuth = await createClient();
  const { data: { user } } = await supabaseAuth.auth.getUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "Not authenticated" }, { status: 401 });
  }

  let body: { id?: string; is_active?: boolean };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.id || typeof body.is_active !== "boolean") {
    return NextResponse.json({ ok: false, error: "id and is_active are required" }, { status: 422 });
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("automation_tokens")
    .update({ is_active: body.is_active })
    .eq("id", body.id);

  if (error) {
    return NextResponse.json({ ok: false, error: "Failed to update token" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
