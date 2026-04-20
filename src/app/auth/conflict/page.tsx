import Link from "next/link";
import { AuthCard } from "~/components/auth/AuthCard";

type ConflictPageProps = {
  searchParams: Promise<{
    error?: string;
    message?: string;
    provider?: string;
  }>;
};

function getConflictMessage({
  error,
  message,
  provider,
}: {
  error?: string;
  message?: string;
  provider?: string;
}) {
  if (message != null && message.length > 0) {
    return message;
  }

  const providerLabel =
    provider != null && provider.length > 0 ? provider : "that provider";

  switch (error) {
    case "account_already_linked_to_different_user":
      return `That ${providerLabel} account is already linked to another user.`;
    case "email_doesn't_match":
    case "LINKING_DIFFERENT_EMAILS_NOT_ALLOWED":
      return `That ${providerLabel} account uses a different email address. Sign in to the matching account first, then link it manually from settings.`;
    case "unable_to_link_account":
    case "account_not_linked":
    case "LINKING_NOT_ALLOWED":
      return `We found an existing account with this email. Sign in to your current account first, then link ${providerLabel} manually from settings.`;
    default:
      return "An account conflict occurred.";
  }
}

export default async function ConflictPage({
  searchParams,
}: ConflictPageProps) {
  const params = await searchParams;
  const message = getConflictMessage(params);

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-12">
      <AuthCard
        description="We blocked this sign-in to keep account linking explicit and secure."
        title="Account conflict"
      >
        <p className="text-sm text-red-600">{message}</p>
        <Link
          className="mt-4 inline-block text-sm text-blue-600 underline hover:text-blue-800"
          href="/auth/sign-in"
        >
          Back to sign in
        </Link>
      </AuthCard>
    </main>
  );
}
