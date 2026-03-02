import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

// --- Types ---

interface AutomationMessageBody {
  roomSlug: string;
  content: string;
  kind?: "notification" | "message";
  externalId?: string;
  metadata?: Record<string, unknown>;
}

interface AutomationToken {
  id: string;
  name: string;
  is_active: boolean;
  allow_all_rooms: boolean;
  allowed_room_ids: string[];
  actor_user_id: string | null;
  can_send_notifications: boolean;
  can_send_messages: boolean;
}

// --- Helpers ---

/** SHA-256 hash the token as a UTF-8 string. Must match: encode(sha256('token'::bytea), 'hex') in Postgres. */
async function hashToken(token: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(token);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Standard error response shape. */
function errorResponse(
  status: number,
  error: string,
  details?: string
): NextResponse {
  return NextResponse.json({ ok: false, error, details }, { status });
}

// --- Route Handler ---

export async function POST(request: NextRequest): Promise<NextResponse> {
  // 1. Extract bearer token
  const authHeader = request.headers.get("authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return errorResponse(401, "Missing or malformed Authorization header");
  }
  const bearerToken = authHeader.slice(7).trim();
  if (!bearerToken) {
    return errorResponse(401, "Empty bearer token");
  }

  // 2. Hash token and look up in DB
  const tokenHash = await hashToken(bearerToken);
  const supabase = createAdminClient();

  const { data: token, error: tokenError } = await supabase
    .from("automation_tokens")
    .select(
      "id, name, is_active, allow_all_rooms, allowed_room_ids, actor_user_id, can_send_notifications, can_send_messages"
    )
    .eq("token_hash", tokenHash)
    .single();

  if (tokenError || !token) {
    return errorResponse(401, "Invalid token");
  }

  const automationToken = token as AutomationToken;

  if (!automationToken.is_active) {
    return errorResponse(403, "Token is disabled");
  }

  // 3. Parse and validate request body
  let body: AutomationMessageBody;
  try {
    body = await request.json();
  } catch {
    return errorResponse(400, "Invalid JSON body");
  }

  const { roomSlug, content, kind = "notification", externalId, metadata } = body;

  if (!roomSlug || typeof roomSlug !== "string") {
    return errorResponse(422, "roomSlug is required and must be a string");
  }
  if (!content || typeof content !== "string") {
    return errorResponse(422, "content is required and must be a string");
  }
  if (content.length > 4000) {
    return errorResponse(422, "content exceeds 4000 character limit");
  }
  if (kind !== "notification" && kind !== "message") {
    return errorResponse(422, 'kind must be "notification" or "message"');
  }

  // Check permission for the requested kind
  if (kind === "notification" && !automationToken.can_send_notifications) {
    return errorResponse(403, "Token does not have notification permission");
  }
  if (kind === "message" && !automationToken.can_send_messages) {
    return errorResponse(403, "Token does not have message permission");
  }

  // 4. Look up the room by slug
  const { data: room, error: roomError } = await supabase
    .from("rooms")
    .select("id, slug, is_direct, is_private")
    .eq("slug", roomSlug)
    .single();

  if (roomError || !room) {
    return errorResponse(404, `Room not found: ${roomSlug}`);
  }

  // 5. Enforce room scope
  if (!automationToken.allow_all_rooms) {
    const allowed = automationToken.allowed_room_ids ?? [];
    if (!allowed.includes(room.id)) {
      return errorResponse(403, "Token does not have access to this room");
    }
  }

  // Block automation into DM rooms — these are private conversations
  if (room.is_direct) {
    return errorResponse(403, "Cannot send automation messages to DM rooms");
  }

  // 6. Idempotency check via externalId
  if (externalId) {
    const { data: existing } = await supabase
      .from("messages")
      .select("id")
      .eq("room_id", room.id)
      .eq("external_id", externalId)
      .maybeSingle();

    if (existing) {
      return NextResponse.json(
        {
          ok: true,
          duplicate: true,
          message: { id: existing.id },
        },
        { status: 200 }
      );
    }
  }

  // 7. Determine message type and user_id
  // "notification" -> system message (no user), "message" -> attributed to actor
  const messageType = kind === "notification" ? "system" : "text";
  const userId =
    kind === "message" ? automationToken.actor_user_id : null;

  // 8. Insert the message
  const insertPayload: Record<string, unknown> = {
    room_id: room.id,
    user_id: userId,
    content,
    type: messageType,
    metadata: {
      ...(metadata ?? {}),
      automation: true,
      token_name: automationToken.name,
    },
    external_id: externalId ?? null,
  };

  const { data: message, error: insertError } = await supabase
    .from("messages")
    .insert(insertPayload)
    .select("id, room_id, type, created_at")
    .single();

  if (insertError) {
    console.error("Automation message insert failed:", insertError);
    return errorResponse(500, "Failed to insert message", insertError.message);
  }

  // 9. Update token last_used_at (fire-and-forget, don't block response)
  supabase
    .from("automation_tokens")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", automationToken.id)
    .then(); // intentionally not awaited

  // 10. Return success
  return NextResponse.json(
    {
      ok: true,
      message: {
        id: message.id,
        roomId: message.room_id,
        roomSlug: room.slug,
        type: message.type,
        createdAt: message.created_at,
      },
    },
    { status: 201 }
  );
}
