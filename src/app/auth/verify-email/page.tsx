import { AuthCard } from "~/components/auth/AuthCard";
import { auth } from "~/lib/auth/better-auth";

type VerifyEmailPageProps = {
  searchParams: Promise<{ token?: string }>;
};

export default async function VerifyEmailPage({
  searchParams,
}: VerifyEmailPageProps) {
  const { token } = await searchParams;

  const content =
    token == null
      ? {
          message: "A verification token is required.",
          tone: "text-red-600",
        }
      : await auth.api
          .verifyEmail({ query: { token } })
          .then(() => ({
            message: "Email verified. You can now sign in.",
            tone: "text-emerald-700",
          }))
          .catch((error: unknown) => ({
            message:
              error instanceof Error
                ? error.message
                : "Unable to verify this email token.",
            tone: "text-red-600",
          }));

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-12">
      <AuthCard
        description="Verification links expire after 24 hours and can only be used once."
        title="Verify email"
      >
        <p className={`text-sm ${content.tone}`}>{content.message}</p>
      </AuthCard>
    </main>
  );
}
