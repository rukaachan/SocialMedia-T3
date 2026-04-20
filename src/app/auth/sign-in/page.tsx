import { AuthCard } from "~/components/auth/AuthCard";
import { AuthStatusMessage } from "~/components/auth/AuthStatusMessage";
import { SignInForm } from "~/components/auth/SignInForm";

const signInMessages = {
  session_cutover:
    "Your previous Auth.js session was retired during the Better Auth cutover. Sign in again to continue under Better Auth.",
} as const;

export default async function SignInPage({
  searchParams,
}: {
  searchParams?: Promise<{ message?: keyof typeof signInMessages }>;
}) {
  const resolvedSearchParams = await searchParams;
  const messageKey = resolvedSearchParams?.message;
  const message =
    messageKey == null ? null : signInMessages[messageKey] ?? null;

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-12">
      <AuthCard
        description="Sign in with your verified email/password credentials."
        title="Sign in"
      >
        <AuthStatusMessage message={message} />
        <SignInForm />
      </AuthCard>
    </main>
  );
}
