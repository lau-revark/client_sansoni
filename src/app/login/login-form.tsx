"use client";

import { useActionState } from "react";
import { login } from "./actions";

export function LoginForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState(login, undefined);
  return (
    <form action={action} className="mt-6 space-y-4">
      <input type="hidden" name="next" value={next} />
      <label className="block">
        <span className="text-sm font-medium text-ink-2">Email</span>
        <input name="email" type="email" required autoComplete="email" className="mt-1 w-full rounded-lg border border-line px-3 py-2.5 outline-none focus:border-accent" />
      </label>
      <label className="block">
        <span className="text-sm font-medium text-ink-2">Password</span>
        <input name="password" type="password" required autoComplete="current-password" className="mt-1 w-full rounded-lg border border-line px-3 py-2.5 outline-none focus:border-accent" />
      </label>
      {state?.error && <p className="text-sm text-bad">{state.error}</p>}
      <button disabled={pending} className="w-full rounded-lg bg-accent py-2.5 font-semibold text-white disabled:opacity-60">
        {pending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
