"use client";

import type { PropsWithChildren } from "react";
import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient();

export type Session = typeof authClient.$Infer.Session;
type SessionHookState = ReturnType<typeof authClient.useSession>;
type DerivedSessionState =
  | (Omit<SessionHookState, "data"> & {
      data: Session;
      status: "authenticated";
    })
  | (Omit<SessionHookState, "data"> & {
      data: null;
      status: "loading" | "unauthenticated";
    });

export type SessionProviderProps = PropsWithChildren<{
  session?: Session | { expires?: string; user?: { id?: string } } | null;
}>;

export function SessionProvider({ children }: SessionProviderProps) {
  return children;
}

export function useSession(): DerivedSessionState {
  const session = authClient.useSession();

  if (session.data != null) {
    return {
      ...session,
      data: session.data,
      status: "authenticated",
    };
  }

  return {
    ...session,
    data: null,
    status: session.isPending ? "loading" : "unauthenticated",
  };
}
