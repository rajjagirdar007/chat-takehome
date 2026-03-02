"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    router.push("/chat");
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="rounded bg-unread/20 p-3 text-sm text-unread">
          {error}
        </div>
      )}

      <div>
        <label className="mb-1 block text-sm text-text-secondary">Email</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="w-full rounded bg-bg-tertiary p-3 text-text-primary outline-none focus:ring-2 focus:ring-accent"
          placeholder="you@example.com"
        />
      </div>

      <div>
        <label className="mb-1 block text-sm text-text-secondary">
          Password
        </label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          className="w-full rounded bg-bg-tertiary p-3 text-text-primary outline-none focus:ring-2 focus:ring-accent"
          placeholder="••••••••"
        />
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded bg-accent p-3 font-medium text-white hover:bg-accent-hover disabled:opacity-50"
      >
        {loading ? "Logging in..." : "Log In"}
      </button>

      <p className="text-center text-sm text-text-muted">
        Don&apos;t have an account?{" "}
        <Link href="/signup" className="text-accent hover:underline">
          Sign up
        </Link>
      </p>
    </form>
  );
}
