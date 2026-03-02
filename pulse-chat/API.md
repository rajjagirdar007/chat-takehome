# Pulse Chat Automation API

## Overview

Send messages into Pulse Chat rooms from external tools (n8n, cURL, CI/CD pipelines).
Messages appear instantly via Supabase Realtime — no polling needed.

## Endpoint

```
POST /api/v1/automation/messages
Authorization: Bearer <token>
Content-Type: application/json
```

## Request Body

| Field        | Type     | Required | Description                                          |
|-------------|----------|----------|------------------------------------------------------|
| `roomSlug`  | string   | yes      | Target room slug (e.g., "general")                   |
| `content`   | string   | yes      | Message text (max 4000 chars, supports markdown)     |
| `kind`      | string   | no       | `"notification"` (default) or `"message"`            |
| `externalId`| string   | no       | Unique ID for idempotent retries                     |
| `metadata`  | object   | no       | Arbitrary key-value pairs stored on the message      |

### Kind behavior

- `notification` — inserts as a system message (centered, no avatar). Best for alerts.
- `message` — inserts as a regular text message attributed to the token's `actor_user_id`.

## Responses

### 201 Created
```json
{
  "ok": true,
  "message": {
    "id": "uuid",
    "roomId": "uuid",
    "roomSlug": "general",
    "type": "system",
    "createdAt": "2026-03-02T12:00:00Z"
  }
}
```

### 200 Duplicate (idempotent replay)
```json
{
  "ok": true,
  "duplicate": true,
  "message": { "id": "uuid" }
}
```

### Error responses
| Status | Meaning                                |
|--------|----------------------------------------|
| 400    | Invalid JSON                           |
| 401    | Missing/invalid token                  |
| 403    | Token disabled, insufficient scope     |
| 404    | Room not found                         |
| 422    | Validation error (missing fields, etc) |
| 500    | Server error                           |

## Setup

### 1. Run the migration

Execute `supabase-migration-api.sql` in the Supabase SQL Editor.

### 2. Set the service role key

Add to `.env.local`:
```
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
```

Find this in Supabase Dashboard → Settings → API → `service_role` key.

### 3. Generate a token

In the Supabase SQL Editor:

```sql
-- Generate a random token (save this output — it's never stored)
SELECT encode(gen_random_bytes(32), 'hex') AS plaintext_token;

-- Insert the hashed version (replace YOUR_TOKEN with the output above)
-- The ::bytea cast hashes the token as a UTF-8 string, matching the JS API route
INSERT INTO public.automation_tokens (name, token_hash, allow_all_rooms)
VALUES (
  'n8n-prod',
  encode(sha256('YOUR_TOKEN'::bytea), 'hex'),
  true
);
```

## Examples

### cURL — Send a notification
```bash
curl -X POST http://localhost:3000/api/v1/automation/messages \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "roomSlug": "general",
    "content": "Deploy v2.1.0 completed successfully",
    "kind": "notification",
    "externalId": "deploy-v2.1.0",
    "metadata": { "source": "github-actions", "env": "production" }
  }'
```

### cURL — Idempotent retry
```bash
# Same externalId = same command is safe to retry
# First call returns 201, subsequent calls return 200 with duplicate: true
curl -X POST http://localhost:3000/api/v1/automation/messages \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "roomSlug": "general",
    "content": "Alert: CPU > 90% on prod-web-3",
    "externalId": "alert-cpu-prod-web-3-2026-03-02T12",
    "metadata": { "source": "monitoring", "severity": "high" }
  }'
```

### n8n HTTP Request Node

| Setting       | Value                                                    |
|---------------|----------------------------------------------------------|
| Method        | POST                                                     |
| URL           | `https://your-app.vercel.app/api/v1/automation/messages` |
| Authentication| Header Auth                                              |
| Header Name   | Authorization                                            |
| Header Value  | Bearer YOUR_TOKEN                                        |
| Body Type     | JSON                                                     |
| Body          | See request body format above                            |

### n8n JSON body example
```json
{
  "roomSlug": "general",
  "content": "Workflow '{{ $workflow.name }}' completed: {{ $json.summary }}",
  "kind": "notification",
  "externalId": "n8n:{{ $workflow.id }}:{{ $execution.id }}",
  "metadata": {
    "source": "n8n",
    "workflow": "{{ $workflow.name }}",
    "executionId": "{{ $execution.id }}"
  }
}
```

## Security Notes

- Tokens are SHA-256 hashed before storage — plaintext is never in the database
- Tokens can be scoped to specific rooms via `allowed_room_ids`
- DM rooms are always blocked from automation
- Tokens can be disabled instantly by setting `is_active = false`
- The service role key (`SUPABASE_SERVICE_ROLE_KEY`) is server-only and never exposed to the browser
