import { and, eq, isNotNull } from "drizzle-orm";
import { redirect } from "next/navigation";
import { AccountLinking } from "~/components/auth/AccountLinking";
import { account } from "~/db/better-auth-schema";
import { db } from "~/db";
import { getServerAuthSession } from "~/lib/auth/server";
import { getLinkedProviders } from "~/server/auth/linking";

export default async function SettingsPage() {
  const session = await getServerAuthSession();

  if (!session?.user?.id) {
    redirect("/auth/sign-in");
  }

  const userId = session.user.id;

  // Fetch linked providers
  const linkedProviders = await getLinkedProviders(userId);

  const credentials = await db
    .select()
    .from(account)
    .where(
      and(
        eq(account.userId, userId),
        eq(account.providerId, "credential"),
        isNotNull(account.password)
      )
    )
    .limit(1);

  const hasCredentials = credentials.length > 0;

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-12">
      <div className="mx-auto w-full max-w-md">
        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-slate-900">Settings</h1>
          <p className="mt-1 text-sm text-slate-600">
            Manage your account and linked sign-in methods.
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <AccountLinking
            linkedProviders={linkedProviders}
            hasCredentials={hasCredentials}
          />
        </div>
      </div>
    </main>
  );
}
