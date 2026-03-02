"use client";

import { useState } from "react";
import { X } from "lucide-react";

interface CreateRoomModalProps {
  onClose: () => void;
  onCreate: (name: string, description: string) => Promise<void>;
}

export function CreateRoomModal({ onClose, onCreate }: CreateRoomModalProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;

    setLoading(true);
    await onCreate(name.trim(), description.trim());
    setLoading(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-md rounded-lg bg-bg-secondary p-6">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-text-primary">
            Create Room
          </h3>
          <button
            onClick={onClose}
            className="text-text-muted hover:text-text-primary"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm text-text-secondary">
              Room Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-full rounded bg-bg-tertiary p-2 text-text-primary outline-none focus:ring-2 focus:ring-accent"
              placeholder="design-team"
              autoFocus
            />
          </div>

          <div>
            <label className="mb-1 block text-sm text-text-secondary">
              Description (optional)
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full rounded bg-bg-tertiary p-2 text-text-primary outline-none focus:ring-2 focus:ring-accent"
              placeholder="What's this room about?"
            />
          </div>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded px-4 py-2 text-sm text-text-secondary hover:bg-bg-tertiary"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !name.trim()}
              className="rounded bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-50"
            >
              {loading ? "Creating..." : "Create"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
