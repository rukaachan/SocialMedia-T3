"use client";

import { useCallback, useEffect, useState } from "react";
import Button from "~/components/Button";
import { authClient, useSession } from "~/lib/auth/client";

type LinkedProvider = {
  id: string;
  provider: string;
  providerAccountId: string;
  type: string;
};

type AccountLinkingProps = {
  linkedProviders: LinkedProvider[];
  hasCredentials: boolean;
};

const PROVIDERS = [
  {
    id: "discord",
    name: "Discord",
    color: "bg-indigo-600 hover:bg-indigo-500",
  },
  { id: "google", name: "Google", color: "bg-red-600 hover:bg-red-500" },
] as const;

export function AccountLinking({
  linkedProviders: initialProviders,
  hasCredentials,
}: AccountLinkingProps) {
  const { data: session } = useSession();
  const [linkedProviders, setLinkedProviders] = useState(initialProviders);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [unlinking, setUnlinking] = useState<string | null>(null);

  // Clear messages after 5 seconds
  useEffect(() => {
    if (error || success) {
      const timer = setTimeout(() => {
        setError(null);
        setSuccess(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [error, success]);

  const handleLinkProvider = useCallback(async (providerId: string) => {
    setError(null);
    setSuccess(null);

    try {
      await authClient.linkSocial({
        callbackURL: "/settings?linked=" + providerId,
        errorCallbackURL: "/auth/conflict?provider=" + providerId,
        provider: providerId,
      });
    } catch {
      setError(`Failed to link ${providerId}. Please try again.`);
    }
  }, []);

  const handleUnlinkProvider = useCallback(
    async (provider: string, providerAccountId: string) => {
      setError(null);
      setSuccess(null);
      setUnlinking(provider);

      try {
        const result = await authClient.unlinkAccount({
          accountId: providerAccountId,
          providerId: provider,
        });

        if (result.error != null) {
          throw new Error(result.error.message || "Failed to unlink provider");
        }

        setLinkedProviders((prev) =>
          prev.filter(
            (p) =>
              !(
                p.provider === provider &&
                p.providerAccountId === providerAccountId
              )
          )
        );
        setSuccess(`Successfully unlinked ${provider}.`);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to unlink provider"
        );
      } finally {
        setUnlinking(null);
      }
    },
    []
  );

  const isProviderLinked = (providerId: string) =>
    linkedProviders.some((p) => p.provider === providerId);

  const canUnlink = () => {
    // Can unlink if user has multiple auth methods
    const authMethodCount = linkedProviders.length + (hasCredentials ? 1 : 0);
    return authMethodCount > 1;
  };

  if (!session?.user) {
    return null;
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">
          Linked Accounts
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          Connect your accounts to sign in with multiple methods.
        </p>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {success && (
        <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
          {success}
        </div>
      )}

      <div className="space-y-4">
        {PROVIDERS.map((provider) => {
          const isLinked = isProviderLinked(provider.id);
          const linkedAccount = linkedProviders.find(
            (p) => p.provider === provider.id
          );

          return (
            <div
              key={provider.id}
              className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-4"
            >
              <div className="flex items-center gap-3">
                <div
                  className={`flex h-10 w-10 items-center justify-center rounded-full ${provider.color} text-white`}
                >
                  {provider.name.charAt(0)}
                </div>
                <div>
                  <p className="font-medium text-slate-900">{provider.name}</p>
                  <p className="text-sm text-slate-500">
                    {isLinked ? "Connected" : "Not connected"}
                  </p>
                </div>
              </div>

              <div>
                {isLinked ? (
                  <Button
                    small
                    gray
                    onClick={() =>
                      linkedAccount &&
                      handleUnlinkProvider(
                        linkedAccount.provider,
                        linkedAccount.providerAccountId
                      )
                    }
                    disabled={!canUnlink() || unlinking === provider.id}
                    className={
                      !canUnlink() ? "cursor-not-allowed opacity-50" : ""
                    }
                  >
                    {unlinking === provider.id ? "Unlinking..." : "Unlink"}
                  </Button>
                ) : (
                  <Button small onClick={() => handleLinkProvider(provider.id)}>
                    Link
                  </Button>
                )}
              </div>
            </div>
          );
        })}

        {/* Credentials status */}
        <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-600 text-white">
              @
            </div>
            <div>
              <p className="font-medium text-slate-900">Email & Password</p>
              <p className="text-sm text-slate-500">
                {hasCredentials ? "Set up" : "Not set up"}
              </p>
            </div>
          </div>
          <p className="text-sm text-slate-400">
            {hasCredentials ? "Active" : "Use sign-up"}
          </p>
        </div>
      </div>

      {!canUnlink() && linkedProviders.length > 0 && (
        <p className="text-sm text-slate-500">
          You must keep at least one sign-in method on your account. Link
          another provider or add a password before unlinking.
        </p>
      )}
    </div>
  );
}
