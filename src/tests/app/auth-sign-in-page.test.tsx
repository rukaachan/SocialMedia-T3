import { render, screen } from "@testing-library/react";
import SignInPage from "~/app/auth/sign-in/page";

vi.mock("~/components/auth/AuthCard", () => ({
  AuthCard: ({
    children,
    description,
    title,
  }: {
    children: React.ReactNode;
    description: string;
    title: string;
  }) => (
    <section>
      <h1>{title}</h1>
      <p>{description}</p>
      {children}
    </section>
  ),
}));

vi.mock("~/components/auth/SignInForm", () => ({
  SignInForm: () => <form data-testid="sign-in-form" />,
}));

describe("src/app/auth/sign-in/page.tsx", () => {
  it("tells cutover users to sign in again under Better Auth", async () => {
    render(
      await SignInPage({
        searchParams: Promise.resolve({ message: "session_cutover" }),
      } as never)
    );

    expect(
      screen.getByText(/sign in again to continue under better auth/i)
    ).toBeInTheDocument();
    expect(screen.getByTestId("sign-in-form")).toBeInTheDocument();
  });
});
