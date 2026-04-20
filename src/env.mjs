import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

const optionalString = z.string().optional();
const optionalUrl = z.string().url().optional();

export const env = createEnv({
  /**
   * Specify your server-side environment variables schema here. This way you can ensure the app
   * isn't built with invalid env vars.
   */
  server: {
    BETTER_AUTH_TRUSTED_ORIGINS: optionalString,
    BETTER_AUTH_URL: optionalUrl,
    BETTER_AUTH_SECRET: optionalString,
    DATABASE_URL: optionalUrl,
    TURSO_DATABASE_URL: z.string().url(),
    TURSO_AUTH_TOKEN: optionalString,
    NODE_ENV: z.enum(["development", "test", "production"]),
    APP_BASE_URL: optionalUrl,
DISCORD_CLIENT_ID: optionalString,
DISCORD_CLIENT_SECRET: optionalString,
GOOGLE_CLIENT_ID: optionalString,
GOOGLE_CLIENT_SECRET: optionalString,
  },

  /**
   * Specify your client-side environment variables schema here. This way you can ensure the app
   * isn't built with invalid env vars. To expose them to the client, prefix them with
   * `NEXT_PUBLIC_`.
   */
  client: {
    // NEXT_PUBLIC_CLIENTVAR: z.string().min(1),
  },

  experimental__runtimeEnv: {},
  /**
   * Run `build` or `dev` with `SKIP_ENV_VALIDATION` to skip env validation.
   * This is especially useful for Docker builds.
   */
  skipValidation: !!process.env.SKIP_ENV_VALIDATION,
});
