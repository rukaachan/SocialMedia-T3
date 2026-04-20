"use client";

import { useState } from "react";
import Button from "~/components/Button";
import { authClient } from "~/lib/auth/client";
import { AuthStatusMessage } from "./AuthStatusMessage";

export function ForgotPasswordForm() {
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
    const email = formData.get("email") as string;

    try {
      const result = await authClient.requestPasswordReset({
        email,
        redirectTo: "/auth/reset-password",
      });

      if (result.error) {
        setError(result.error.message || "Unable to request a reset link.");
      } else {
        setMessage("If that email exists, a reset link has been generated.");
      }
    } catch {
      setError("Unable to request a reset link.");
    } finally {
      setIsPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <label className="flex flex-col gap-2 text-sm text-slate-700">
        Email
        <input
          className="rounded-xl border border-slate-300 px-3 py-2"
          name="email"
          type="email"
          required
        />
      </label>
      <AuthStatusMessage debugUrl={debugUrl} error={error} message={message} />
      <Button type="submit" disabled={isPending}>
        {isPending ? "Sending..." : "Send reset link"}
      </Button>
    </form>
  );
}
