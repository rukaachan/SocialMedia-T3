"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import Button from "~/components/Button";
import { authClient } from "~/lib/auth/client";
import { AuthStatusMessage } from "./AuthStatusMessage";

export function SignInForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsPending(true);

    const formData = new FormData(event.currentTarget);
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;

    try {
      const result = await authClient.signIn.email({
        email,
        password,
        callbackURL: "/",
      });

      if (result.error) {
        setError(result.error.message || "Invalid email or password.");
      } else {
        router.push("/");
        router.refresh();
      }
    } catch {
      setError("Invalid email or password.");
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
      <label className="flex flex-col gap-2 text-sm text-slate-700">
        Password
        <input
          className="rounded-xl border border-slate-300 px-3 py-2"
          name="password"
          type="password"
          required
        />
      </label>
      <AuthStatusMessage error={error} />
      <Button type="submit" disabled={isPending}>
        {isPending ? "Signing in..." : "Sign in"}
      </Button>
    </form>
  );
}
