import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import type { Session } from "next-auth";
import type { AppType } from "next/app";
import MyApp from "~/pages/_app";

const sessionProviderSpy = vi.fn();
const pageComponentSpy = vi.fn();

vi.mock("next/head", () => ({
  default: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

vi.mock("next-auth/react", () => ({
  SessionProvider: ({
    children,
    session,
  }: {
    children: ReactNode;
    session: Session | null;
  }) => {
    sessionProviderSpy(session);

    return <div data-testid="session-provider">{children}</div>;
  },
}));

vi.mock("~/components/SideNav", () => ({
  SideNav: () => <nav data-testid="side-nav">Side navigation</nav>,
}));

vi.mock("~/utils/api", () => ({
  api: {
    withTRPC: (component: unknown) => component,
  },
}));

describe("src/pages/_app.tsx", () => {
  it("wraps pages with providers and shared shell", () => {
    const session = {
      expires: new Date(Date.now() + 60_000).toISOString(),
      user: { id: "user-1" },
    } as Session;

    const PageComponent = (props: { greeting: string }) => {
      pageComponentSpy(props);

      return <main>{props.greeting}</main>;
    };

    const TestedApp = MyApp as AppType<{
      greeting: string;
      session: Session | null;
    }>;

    render(
      <TestedApp
        Component={PageComponent}
        pageProps={{ greeting: "Hello test", session }}
        router={{} as never}
      />
    );

    expect(screen.getByTestId("session-provider")).toBeInTheDocument();
    expect(screen.getByTestId("side-nav")).toBeInTheDocument();
    expect(screen.getByText("Hello test")).toBeInTheDocument();
    expect(sessionProviderSpy).toHaveBeenCalledWith(session);
    expect(pageComponentSpy).toHaveBeenCalledWith({ greeting: "Hello test" });
  });
});
