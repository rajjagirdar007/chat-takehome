"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, Trash2, Copy, Check, ToggleLeft, ToggleRight, ArrowLeft, Key } from "lucide-react";
import { useRouter } from "next/navigation";

interface TokenRow {
  id: string;
  name: string;
  is_active: boolean;
  allow_all_rooms: boolean;
  can_send_notifications: boolean;
  can_send_messages: boolean;
  last_used_at: string | null;
  created_at: string;
}

export default function SettingsPage() {
  const router = useRouter();
  const [tokens, setTokens] = useState<TokenRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Create token state
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);

  // Shown once after creation — plaintext token
  const [revealedToken, setRevealedToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const fetchTokens = useCallback(async () => {
    const res = await fetch("/api/v1/automation/tokens");
    const data = await res.json();
    if (data.ok) {
      setTokens(data.tokens);
    } else {
      setError(data.error);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchTokens();
  }, [fetchTokens]);

  async function handleCreate() {
    if (!newName.trim()) return;
    setCreating(true);
    setError(null);

    const res = await fetch("/api/v1/automation/tokens", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName.trim() }),
    });
    const data = await res.json();

    if (data.ok) {
      setRevealedToken(data.token.plaintext);
      setNewName("");
      setShowCreate(false);
      await fetchTokens();
    } else {
      setError(data.error);
    }
    setCreating(false);
  }

  async function handleToggle(id: string, currentActive: boolean) {
    const res = await fetch("/api/v1/automation/tokens", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, is_active: !currentActive }),
    });
    const data = await res.json();
    if (data.ok) {
      setTokens((prev) =>
        prev.map((t) => (t.id === id ? { ...t, is_active: !currentActive } : t))
      );
    }
  }

  async function handleDelete(id: string) {
    const res = await fetch("/api/v1/automation/tokens", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    const data = await res.json();
    if (data.ok) {
      setTokens((prev) => prev.filter((t) => t.id !== id));
    }
  }

  function handleCopy() {
    if (!revealedToken) return;
    navigator.clipboard.writeText(revealedToken);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function formatDate(dateStr: string | null): string {
    if (!dateStr) return "Never";
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  }

  return (
    <div className="flex h-full flex-1 flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-border px-6 py-4">
        <button
          onClick={() => router.push("/chat")}
          className="text-text-muted hover:text-text-primary"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="text-lg font-bold text-text-primary">Settings</h1>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="mx-auto max-w-2xl">
          {/* API Tokens Section */}
          <div className="mb-8">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold text-text-primary">
                  API Tokens
                </h2>
                <p className="mt-1 text-sm text-text-muted">
                  Create tokens to send messages from external tools like n8n, cURL, or CI/CD pipelines.
                </p>
              </div>
              <button
                onClick={() => setShowCreate(true)}
                className="flex items-center gap-1.5 rounded bg-accent px-3 py-1.5 text-sm font-medium text-white hover:bg-accent-hover"
              >
                <Plus className="h-3.5 w-3.5" />
                New Token
              </button>
            </div>

            {/* Revealed token banner — shown once after creation */}
            {revealedToken && (
              <div className="mb-4 rounded-lg border border-accent/30 bg-accent/10 p-4">
                <p className="mb-2 text-sm font-medium text-text-primary">
                  Your new token — copy it now, it won&apos;t be shown again:
                </p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 overflow-x-auto rounded bg-bg-tertiary px-3 py-2 font-mono text-sm text-text-primary">
                    {revealedToken}
                  </code>
                  <button
                    onClick={handleCopy}
                    className="shrink-0 rounded bg-bg-tertiary p-2 text-text-muted hover:text-text-primary"
                    title="Copy token"
                  >
                    {copied ? (
                      <Check className="h-4 w-4 text-online" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </button>
                </div>
                <div className="mt-3 rounded bg-bg-tertiary p-3">
                  <p className="mb-1 text-xs font-medium text-text-muted">Quick test with cURL:</p>
                  <code className="block whitespace-pre-wrap text-xs text-text-secondary">
                    {`curl -X POST ${typeof window !== "undefined" ? window.location.origin : "http://localhost:3000"}/api/v1/automation/messages \\\n  -H "Authorization: Bearer ${revealedToken}" \\\n  -H "Content-Type: application/json" \\\n  -d '{"roomSlug":"general","content":"Hello from automation!"}'`}
                  </code>
                </div>
                <button
                  onClick={() => setRevealedToken(null)}
                  className="mt-3 text-xs text-text-muted hover:text-text-primary"
                >
                  Dismiss
                </button>
              </div>
            )}

            {/* Create token form */}
            {showCreate && (
              <div className="mb-4 rounded-lg border border-border bg-bg-tertiary p-4">
                <label className="mb-2 block text-sm font-medium text-text-primary">
                  Token name
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                    placeholder="e.g. n8n-prod, github-actions, monitoring"
                    className="flex-1 rounded bg-bg-primary px-3 py-2 text-sm text-text-primary placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-accent"
                    autoFocus
                  />
                  <button
                    onClick={handleCreate}
                    disabled={creating || !newName.trim()}
                    className="rounded bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-50"
                  >
                    {creating ? "Creating..." : "Create"}
                  </button>
                  <button
                    onClick={() => {
                      setShowCreate(false);
                      setNewName("");
                    }}
                    className="rounded px-3 py-2 text-sm text-text-muted hover:bg-bg-hover"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {error && (
              <div className="mb-4 rounded border border-unread/30 bg-unread/10 px-4 py-2 text-sm text-unread">
                {error}
              </div>
            )}

            {/* Token list */}
            {loading ? (
              <p className="text-sm text-text-muted">Loading tokens...</p>
            ) : tokens.length === 0 ? (
              <div className="rounded-lg border border-border bg-bg-tertiary p-8 text-center">
                <Key className="mx-auto mb-3 h-8 w-8 text-text-muted" />
                <p className="text-sm text-text-muted">
                  No API tokens yet. Create one to start sending automated messages.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {tokens.map((token) => (
                  <div
                    key={token.id}
                    className="flex items-center gap-4 rounded-lg border border-border bg-bg-tertiary px-4 py-3"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-text-primary">
                          {token.name}
                        </span>
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                            token.is_active
                              ? "bg-online/20 text-online"
                              : "bg-text-muted/20 text-text-muted"
                          }`}
                        >
                          {token.is_active ? "Active" : "Disabled"}
                        </span>
                      </div>
                      <p className="mt-0.5 text-xs text-text-muted">
                        Created {formatDate(token.created_at)}
                        {token.last_used_at && (
                          <> &middot; Last used {formatDate(token.last_used_at)}</>
                        )}
                      </p>
                    </div>
                    <button
                      onClick={() => handleToggle(token.id, token.is_active)}
                      className="shrink-0 text-text-muted hover:text-text-primary"
                      title={token.is_active ? "Disable token" : "Enable token"}
                    >
                      {token.is_active ? (
                        <ToggleRight className="h-5 w-5 text-online" />
                      ) : (
                        <ToggleLeft className="h-5 w-5" />
                      )}
                    </button>
                    <button
                      onClick={() => handleDelete(token.id)}
                      className="shrink-0 text-text-muted hover:text-unread"
                      title="Delete token"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
