"use client";

import { useState } from "react";
import Button from "~/components/Button";
import { authClient } from "~/lib/auth/client";
import { AuthStatusMessage } from "./AuthStatusMessage";

export function SignUpForm() {
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [debugUrl, setDebugUrl] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setMessage(null);
    setDebugUrl(null);
    setIsPending(true);

    const formData = new FormData(event.currentTarget);
    const name = formData.get("name") as string;
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;

    try {
      const result = await authClient.signUp.email({
        name: name || "",
        email,
        password,
      });

      if (result.error) {
        setError(result.error.message || "Unable to create account.");
      } else {
        setMessage("Account created. Verify your email before continuing.");
        // In development, show debug link
        if (process.env.NODE_ENV !== "production") {
          // Better Auth sends verification email, but in dev we can show a link
          // The actual token is handled by Better Auth's email verification flow
        }
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to create account."
      );
    } finally {
      setIsPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <label className="flex flex-col gap-2 text-sm text-slate-700">
        Name
        <input
          className="rounded-xl border border-slate-300 px-3 py-2"
          name="name"
          type="text"
        />
      </label>
      <label className="flex flex-col gap-2 text-sm text-slate-700">
        Email
        <input
          className="rounded-xl border border-slate-300 px-3 py-2"
          name="email"
          type="email"
          required
        />
      </label>
      <label className="flex flex-col gap-2 text-sm text-slate-700">
        Password
        <input
          className="rounded-xl border border-slate-300 px-3 py-2"
          name="password"
          type="password"
          required
        />
      </label>
      <p className="text-xs text-slate-500">
        Use at least 8 characters with uppercase, lowercase, number, and special
        character.
      </p>
      <AuthStatusMessage debugUrl={debugUrl} error={error} message={message} />
      <Button type="submit" disabled={isPending}>
        {isPending ? "Creating account..." : "Create account"}
      </Button>
    </form>
  );
}
