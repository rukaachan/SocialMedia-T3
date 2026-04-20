"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import Button from "~/components/Button";
import { authClient } from "~/lib/auth/client";
import { AuthStatusMessage } from "./AuthStatusMessage";

type ResetPasswordFormProps = {
  token: string;
};

export function ResetPasswordForm({ token }: ResetPasswordFormProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setMessage(null);
    setIsPending(true);

    const formData = new FormData(event.currentTarget);
    const password = formData.get("password") as string;

    try {
      const result = await authClient.resetPassword({
        newPassword: password,
        token,
      });

      if (result.error) {
        setError(result.error.message || "Unable to reset password.");
      } else {
        setMessage("Password updated. Sign in with your new password.");
        setTimeout(() => {
          router.push("/auth/sign-in");
        }, 2000);
      }
    } catch {
      setError("Unable to reset password.");
    } finally {
      setIsPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <label className="flex flex-col gap-2 text-sm text-slate-700">
        New password
        <input
          className="rounded-xl border border-slate-300 px-3 py-2"
          name="password"
          type="password"
          required
        />
      </label>
      <AuthStatusMessage error={error} message={message} />
      <Button type="submit" disabled={isPending}>
        {isPending ? "Updating..." : "Update password"}
      </Button>
    </form>
  );
}
