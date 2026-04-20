import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import bcrypt from "bcryptjs";
import { betterAuth } from "better-auth";
import { logAuthEvent } from "~/lib/auth/audit";
import { db } from "~/db";
import { betterAuthSchema } from "~/db/better-auth-schema";
import { getPlatformEnv } from "~/server/platform/env";

const platformEnv = getPlatformEnv();

function reportAuthLink(
  kind: "password-reset" | "verify-email",
  payload: {
    email: string;
    url: string;
  },
) {
  logAuthEvent(
    kind === "password-reset" ? "password_reset_link_generated" : "verify_email_link_generated",
    { email: payload.email },
  );
}

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "sqlite",
    schema: betterAuthSchema,
  }),
  secret: platformEnv.auth.secret,
  baseURL: platformEnv.app.baseUrl,
  trustedOrigins: platformEnv.auth.trustedOrigins,
  socialProviders: {
    ...(platformEnv.auth.discord.clientId != null && {
      discord: {
        clientId: platformEnv.auth.discord.clientId,
        clientSecret: platformEnv.auth.discord.clientSecret ?? undefined,
      },
    }),
    ...(platformEnv.auth.google.clientId != null && {
      google: {
        clientId: platformEnv.auth.google.clientId,
        clientSecret: platformEnv.auth.google.clientSecret ?? undefined,
      },
    }),
  },
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
    minPasswordLength: 12,
    maxPasswordLength: 128,
    resetPasswordTokenExpiresIn: 3600,
    sendResetPassword: async ({ user, url }) => {
      reportAuthLink("password-reset", { email: user.email, url });
    },
    password: {
      hash: async (password) => bcrypt.hash(password, 12),
      verify: async ({ hash, password }) => bcrypt.compare(password, hash),
    },
  },
  emailVerification: {
    sendOnSignUp: true,
    sendVerificationEmail: async ({ user, url }) => {
      reportAuthLink("verify-email", { email: user.email, url });
    },
  },
  account: {
    accountLinking: {
      enabled: true,
      trustedProviders: [],
      allowDifferentEmails: false,
      disableImplicitLinking: true,
      allowUnlinkingAll: false,
    },
  },
});

export type BetterAuthServer = typeof auth;
