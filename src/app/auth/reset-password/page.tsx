import { AuthCard } from "~/components/auth/AuthCard";
import { ResetPasswordForm } from "~/components/auth/ResetPasswordForm";

type ResetPasswordPageProps = {
  searchParams: Promise<{ token?: string }>;
};

export default async function ResetPasswordPage({
  searchParams,
}: ResetPasswordPageProps) {
  const { token } = await searchParams;

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-12">
      <AuthCard
        description="Choose a new password that meets the app security requirements."
        title="Reset password"
      >
        {token != null ? (
          <ResetPasswordForm token={token} />
        ) : (
          <p className="text-sm text-red-600">A reset token is required.</p>
        )}
      </AuthCard>
    </main>
  );
}
