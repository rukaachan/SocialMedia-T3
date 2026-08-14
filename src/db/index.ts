import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { env } from "~/env.mjs";
import { fetch as platformFetch } from "~/server/platform/global-fetch";
import * as schema from "./schema";

const url = env.TURSO_DATABASE_URL;

export const client = createClient({
  url,
  fetch: platformFetch,
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

const featureTableStatements = [
  'CREATE TABLE IF NOT EXISTS "mediaAsset" ("id" text PRIMARY KEY NOT NULL, "ownerId" text NOT NULL, "tweetId" text, "objectKey" text NOT NULL, "purpose" text NOT NULL, "status" text NOT NULL DEFAULT \'pending\', "mimeType" text NOT NULL, "byteSize" integer NOT NULL, "width" integer NOT NULL, "height" integer NOT NULL, "sortOrder" integer NOT NULL DEFAULT 0, "altText" text, "createdAt" text NOT NULL, "attachedAt" text, "deletedAt" text, FOREIGN KEY ("ownerId") REFERENCES "user"("id") ON DELETE cascade, FOREIGN KEY ("tweetId") REFERENCES "tweet"("id") ON DELETE cascade);',
  'CREATE UNIQUE INDEX IF NOT EXISTS "media_asset_object_key_idx" ON "mediaAsset" ("objectKey");',
  'CREATE INDEX IF NOT EXISTS "media_asset_owner_idx" ON "mediaAsset" ("ownerId");',
  'CREATE INDEX IF NOT EXISTS "media_asset_tweet_idx" ON "mediaAsset" ("tweetId", "sortOrder");',
  'CREATE INDEX IF NOT EXISTS "media_asset_status_created_at_idx" ON "mediaAsset" ("status", "createdAt");',
  'CREATE TABLE IF NOT EXISTS "bookmark" ("userId" text NOT NULL, "tweetId" text NOT NULL, "createdAt" text NOT NULL, PRIMARY KEY ("userId", "tweetId"), FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE cascade, FOREIGN KEY ("tweetId") REFERENCES "tweet"("id") ON DELETE cascade);',
  'CREATE INDEX IF NOT EXISTS "bookmark_user_created_at_idx" ON "bookmark" ("userId", "createdAt");',
  'CREATE INDEX IF NOT EXISTS "bookmark_tweet_idx" ON "bookmark" ("tweetId");',
];

function quoteIdentifier(identifier: string) {
  return `"${identifier.replaceAll('"', '""')}"`;
}

function isBusyError(error: unknown) {
  return (
    (typeof error === "object" && error != null && "code" in error ? String(error.code) : "") ===
      "SQLITE_BUSY" ||
    (error instanceof Error && error.message.includes("SQLITE_BUSY"))
  );
}

async function executeSchemaStatement(statement: string) {
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await client.execute(statement);
    } catch (error) {
      if (!isBusyError(error) || attempt >= 6) throw error;
      await new Promise((resolve) => setTimeout(resolve, 25 * 2 ** attempt));
    }
  }
}

async function ensureColumn(tableName: string, columnName: string, definition: string) {
  const columns = await executeSchemaStatement(`PRAGMA table_info(${quoteIdentifier(tableName)})`);
  const exists = columns.rows.some((column) => String(column.name) === columnName);

  if (!exists) {
    try {
      await executeSchemaStatement(
        `ALTER TABLE ${quoteIdentifier(tableName)} ADD COLUMN ${definition}`,
      );
    } catch (error) {
      // Multiple local Next.js workers can observe the missing column together.
      // Another worker may have added it while this one was waiting on SQLite.
      if (!(error instanceof Error) || !error.message.includes("duplicate column name")) {
        throw error;
      }
    }
  }
}

export const schemaReady = (async () => {
  if (url.startsWith("file:")) {
    await executeSchemaStatement("PRAGMA foreign_keys = ON;");
  }

  for (const statement of schemaStatements) {
    await executeSchemaStatement(statement);
  }

  // These additive columns keep the runtime bootstrap safe for existing
  // legacy databases. The checked-in Drizzle migration remains authoritative
  // for deployed environments and records the same compatibility work.
  await ensureColumn("user", "bio", '"bio" text');
  await ensureColumn("user", "avatarKey", '"avatarKey" text');
  await ensureColumn("tweet", "parentId", '"parentId" text');
  await ensureColumn("tweet", "updatedAt", "\"updatedAt\" text NOT NULL DEFAULT ''");
  await ensureColumn("tweet", "deletedAt", '"deletedAt" text');
  await executeSchemaStatement(
    'UPDATE "tweet" SET "updatedAt" = "createdAt" WHERE "updatedAt" = \'\' OR "updatedAt" IS NULL',
  );

  for (const statement of featureTableStatements) {
    await executeSchemaStatement(statement);
  }
})();

export type Database = typeof db;
