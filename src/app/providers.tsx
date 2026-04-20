"use client";

import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink } from "@trpc/client";
import superjson from "superjson";
import { SessionProvider, type SessionProviderProps } from "~/lib/auth/client";
import { api } from "~/utils/api";
import { getBaseUrl } from "~/lib/platform/base-url";
import { TRPC_API_ENDPOINT } from "~/lib/trpc/endpoint";

export function Providers({
  children,
  session,
}: {
  children: React.ReactNode;
  session: SessionProviderProps["session"];
}) {
  const [queryClient] = useState(() => new QueryClient());
  const [trpcClient] = useState(() =>
    api.createClient({
      links: [
        httpBatchLink({
          url: `${getBaseUrl()}${TRPC_API_ENDPOINT}`,
          transformer: superjson,
        }),
      ],
    })
  );

  return (
    <SessionProvider session={session}>
      <api.Provider client={trpcClient} queryClient={queryClient}>
        <QueryClientProvider client={queryClient}>
          {children}
        </QueryClientProvider>
      </api.Provider>
    </SessionProvider>
  );
}
