import { type Metadata } from "next";
import { redirect } from "next/navigation";
import { Providers } from "./providers";
import { SideNav } from "~/components/SideNav";
import { getAuthSessionCutoverState, getServerAuthSession } from "~/lib/auth/server";

import "~/styles/globals.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Tweeva",
  description: "Tweeva is a lightweight social app for posting, following, and sharing updates.",
  icons: [{ rel: "icon", url: "/favicon.ico" }],
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerAuthSession();

  if (session == null) {
    const cutoverState = await getAuthSessionCutoverState();

    if (cutoverState.requiresReauthentication && cutoverState.redirectTo != null) {
      redirect(cutoverState.redirectTo);
    }
  }

  return (
    <html lang="en">
      <body>
        <Providers session={session}>
          <div className="container mx-auto flex items-start sm:px-4">
            <SideNav />
            <div className="min-h-screen flex-grow border-x">{children}</div>
          </div>
        </Providers>
      </body>
    </html>
  );
}
