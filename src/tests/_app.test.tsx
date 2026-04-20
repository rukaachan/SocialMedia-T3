import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import type { AppSession } from "~/lib/auth/server";
import { Providers } from "~/app/providers";

const sessionProviderSpy = vi.fn();

vi.mock("~/lib/auth/client", () => ({
  SessionProvider: ({
    children,
    session,
  }: {
    children: ReactNode;
    session: AppSession | null;
  }) => {
    sessionProviderSpy(session);

    return <div data-testid="session-provider">{children}</div>;
  },
}));

vi.mock("@tanstack/react-query", () => ({
  QueryClient: class QueryClient {
    constructor() {}
  },
  QueryClientProvider: ({ children }: { children: ReactNode }) => (
    <div data-testid="query-client-provider">{children}</div>
  ),
}));

vi.mock("~/utils/api", () => ({
  api: {
    createClient: vi.fn().mockReturnValue({}),
    Provider: ({ children }: { children: ReactNode }) => (
      <div data-testid="trpc-provider">{children}</div>
    ),
  },
}));

describe("src/app/providers.tsx", () => {
  it("wraps children with session and tRPC providers", () => {
    const session = {
      expires: new Date(Date.now() + 60_000).toISOString(),
      user: { id: "user-1" },
    } as AppSession;

    render(
      <Providers session={session}>
        <main>Test content</main>
      </Providers>
    );

    expect(screen.getByTestId("session-provider")).toBeInTheDocument();
    expect(screen.getByTestId("trpc-provider")).toBeInTheDocument();
    expect(screen.getByTestId("query-client-provider")).toBeInTheDocument();
    expect(screen.getByText("Test content")).toBeInTheDocument();
    expect(sessionProviderSpy).toHaveBeenCalledWith(session);
  });
});
