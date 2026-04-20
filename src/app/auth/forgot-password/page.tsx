import { AuthCard } from "~/components/auth/AuthCard";
import { ForgotPasswordForm } from "~/components/auth/ForgotPasswordForm";

export default async function ForgotPasswordPage() {
  return (
    <main className="min-h-screen bg-slate-50 px-4 py-12">
      <AuthCard
        description="Request a one-hour password reset link for your credentials account."
        title="Forgot password"
      >
        <ForgotPasswordForm />
      </AuthCard>
    </main>
  );
}
