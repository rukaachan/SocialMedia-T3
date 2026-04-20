import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { env } from "~/env.mjs";
import * as schema from "./schema";

const url = env.TURSO_DATABASE_URL;

export const client = createClient({
  url,
  ...(env.TURSO_AUTH_TOKEN != null && url.startsWith("libsql://")
    ? { authToken: env.TURSO_AUTH_TOKEN }
    : {}),
});

export const db = drizzle(client, { schema });

const schemaStatements = [
  'CREATE TABLE IF NOT EXISTS "user" ("id" text PRIMARY KEY NOT NULL, "name" text, "email" text, "emailVerified" text, "image" text, "createdAt" text NOT NULL, "updatedAt" text NOT NULL);',
  'CREATE UNIQUE INDEX IF NOT EXISTS "user_email_idx" ON "user" ("email");',
  'CREATE TABLE IF NOT EXISTS "account" ("id" text PRIMARY KEY NOT NULL, "userId" text NOT NULL, "type" text NOT NULL, "provider" text NOT NULL, "providerAccountId" text NOT NULL, "refreshToken" text, "accessToken" text, "expiresAt" integer, "tokenType" text, "scope" text, "idToken" text, "sessionState" text, FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE cascade);',
  'CREATE UNIQUE INDEX IF NOT EXISTS "account_provider_account_idx" ON "account" ("provider", "providerAccountId");',
  'CREATE INDEX IF NOT EXISTS "account_user_idx" ON "account" ("userId");',
  'CREATE TABLE IF NOT EXISTS "session" ("id" text PRIMARY KEY NOT NULL, "sessionToken" text NOT NULL, "userId" text NOT NULL, "expires" text NOT NULL, FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE cascade);',
  'CREATE UNIQUE INDEX IF NOT EXISTS "session_token_idx" ON "session" ("sessionToken");',
  'CREATE INDEX IF NOT EXISTS "session_user_idx" ON "session" ("userId");',
  'CREATE TABLE IF NOT EXISTS "verificationToken" ("identifier" text NOT NULL, "token" text NOT NULL, "expires" text NOT NULL, PRIMARY KEY ("identifier", "token"));',
  'CREATE UNIQUE INDEX IF NOT EXISTS "verification_token_idx" ON "verificationToken" ("token");',
  'CREATE TABLE IF NOT EXISTS "credential" ("id" text PRIMARY KEY NOT NULL, "userId" text NOT NULL UNIQUE, "hashedPassword" text NOT NULL, FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE cascade);',
  'CREATE UNIQUE INDEX IF NOT EXISTS "credential_user_idx" ON "credential" ("userId");',
  'CREATE TABLE IF NOT EXISTS "passwordResetToken" ("id" text PRIMARY KEY NOT NULL, "userId" text NOT NULL, "token" text NOT NULL, "expires" text NOT NULL, "usedAt" text, FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE cascade);',
  'CREATE UNIQUE INDEX IF NOT EXISTS "password_reset_token_idx" ON "passwordResetToken" ("token");',
  'CREATE INDEX IF NOT EXISTS "password_reset_user_idx" ON "passwordResetToken" ("userId");',
  'CREATE TABLE IF NOT EXISTS "tweet" ("id" text PRIMARY KEY NOT NULL, "userId" text NOT NULL, "content" text NOT NULL, "createdAt" text NOT NULL, FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE cascade);',
  'CREATE UNIQUE INDEX IF NOT EXISTS "tweet_created_at_id_idx" ON "tweet" ("createdAt", "id");',
  'CREATE INDEX IF NOT EXISTS "tweet_user_idx" ON "tweet" ("userId");',
  'CREATE TABLE IF NOT EXISTS "like" ("userId" text NOT NULL, "tweetId" text NOT NULL, PRIMARY KEY ("userId", "tweetId"), FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE cascade, FOREIGN KEY ("tweetId") REFERENCES "tweet"("id") ON DELETE cascade);',
  'CREATE INDEX IF NOT EXISTS "like_user_idx" ON "like" ("userId");',
  'CREATE INDEX IF NOT EXISTS "like_tweet_idx" ON "like" ("tweetId");',
  'CREATE TABLE IF NOT EXISTS "userFollower" ("followingId" text NOT NULL, "followerId" text NOT NULL, PRIMARY KEY ("followingId", "followerId"), FOREIGN KEY ("followingId") REFERENCES "user"("id") ON DELETE cascade, FOREIGN KEY ("followerId") REFERENCES "user"("id") ON DELETE cascade);',
  'CREATE INDEX IF NOT EXISTS "user_follower_following_idx" ON "userFollower" ("followingId");',
  'CREATE INDEX IF NOT EXISTS "user_follower_follower_idx" ON "userFollower" ("followerId");',
];

export const schemaReady = (async () => {
  if (url.startsWith("file:")) {
    await client.execute("PRAGMA foreign_keys = ON;");
  }

  for (const statement of schemaStatements) {
    await client.execute(statement);
  }
})();

export type Database = typeof db;
