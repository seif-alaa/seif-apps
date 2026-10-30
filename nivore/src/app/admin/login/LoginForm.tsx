"use client";

import { useActionState } from "react";
import { signIn } from "./actions";

export function LoginForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState(signIn, { error: null });
  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="next" value={next} />
      <label className="block">
        <span className="field-label">Email</span>
        <input name="email" type="email" autoComplete="username" className="field" required />
      </label>
      <label className="block">
        <span className="field-label">Password</span>
        <input name="password" type="password" autoComplete="current-password" className="field" required />
      </label>
      {state.error && <p role="alert" className="field-error">{state.error}</p>}
      <button className="btn btn-primary w-full" disabled={pending}>{pending ? "Signing in…" : "Sign in"}</button>
    </form>
  );
}
