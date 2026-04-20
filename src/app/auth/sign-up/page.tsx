import { AuthCard } from "~/components/auth/AuthCard";
import { SignUpForm } from "~/components/auth/SignUpForm";

export default async function SignUpPage() {
  return (
    <main className="min-h-screen bg-slate-50 px-4 py-12">
      <AuthCard
        description="Create an email/password account and verify your inbox before full access."
        title="Create account"
      >
        <SignUpForm />
      </AuthCard>
    </main>
  );
}
