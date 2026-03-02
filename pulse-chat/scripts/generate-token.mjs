#!/usr/bin/env node
/**
 * Generates or hashes automation tokens for the Pulse Chat API.
 * Uses the same SHA-256 logic as the API route, so hashes always match.
 *
 * Generate a new token:
 *   node scripts/generate-token.mjs
 *   node scripts/generate-token.mjs --name my-workflow
 *
 * Hash an existing token (to fix or re-insert):
 *   node scripts/generate-token.mjs --token YOUR_EXISTING_TOKEN
 *   node scripts/generate-token.mjs --token YOUR_TOKEN --name my-workflow
 */
import { randomBytes, createHash } from "crypto";

// Parse args
const args = process.argv.slice(2);
let name = "n8n-prod";
let existingToken = null;

for (let i = 0; i < args.length; i++) {
  if (args[i] === "--name" && args[i + 1]) {
    name = args[++i];
  } else if (args[i] === "--token" && args[i + 1]) {
    existingToken = args[++i];
  }
}

const token = existingToken || randomBytes(32).toString("hex");

// Hash as UTF-8 string — matches the API route's crypto.subtle.digest("SHA-256", TextEncoder.encode(token))
const hash = createHash("sha256").update(token, "utf8").digest("hex");

console.log("\n--- Automation Token ---");
console.log(`Name:       ${name}`);
console.log(`Token:      ${token}`);
console.log(`Hash:       ${hash}`);

if (existingToken) {
  console.log("\nTo fix an existing row, run this SQL:\n");
  console.log(`UPDATE public.automation_tokens`);
  console.log(`SET token_hash = '${hash}'`);
  console.log(`WHERE name = '${name}';\n`);
} else {
  console.log("\nSave the token above — it cannot be recovered from the database.\n");
  console.log("Run this SQL in Supabase SQL Editor:\n");
  console.log(`INSERT INTO public.automation_tokens (name, token_hash, allow_all_rooms)`);
  console.log(`VALUES ('${name}', '${hash}', true);\n`);
}
