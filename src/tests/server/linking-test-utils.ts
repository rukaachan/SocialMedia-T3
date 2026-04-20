import { createClient } from "@libsql/client";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/libsql";
import { unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import * as schema from "~/db/better-auth-schema";
import { account, user } from "~/db/better-auth-schema";

type TestDatabase = ReturnType<typeof drizzle<typeof schema>>;

export type LinkingTestContext = {
  database: TestDatabase;
  linkingDatabase: never;
  createId: (prefix: string) => () => string;
  createTestAccount: (
    userId: string,
    providerId: string,
    accountId: string,
    options?: { password?: string },
  ) => Promise<void>;
  createTestUser: (
    id: string,
    email: string,
    name?: string,
  ) => Promise<{
    id: string;
    email: string;
    name: string;
  }>;
  findAccountsForUser: (userId: string) => Promise<Array<typeof account.$inferSelect>>;
  cleanup: () => Promise<void>;
};

async function executeStatements(database: TestDatabase, statements: string[]) {
  for (const statement of statements) {
    await database.$client.execute(statement);
  }
}

export async function createLinkingTestContext(): Promise<LinkingTestContext> {
  const databasePath = join(tmpdir(), `tweeva-linking-${crypto.randomUUID()}.db`);
  const client = createClient({ url: `file:${databasePath}` });
  const database = drizzle(client, { schema });
  const linkingDatabase = database as never;

  await executeStatements(database, [
    'CREATE TABLE "user" ("id" text PRIMARY KEY NOT NULL, "name" text NOT NULL, "email" text NOT NULL, "email_verified" integer DEFAULT 0 NOT NULL, "image" text, "created_at" integer NOT NULL, "updated_at" integer NOT NULL);',
    'CREATE UNIQUE INDEX "user_email_unique" ON "user" ("email");',
    'CREATE TABLE "account" ("id" text PRIMARY KEY NOT NULL, "account_id" text NOT NULL, "provider_id" text NOT NULL, "user_id" text NOT NULL, "access_token" text, "refresh_token" text, "id_token" text, "access_token_expires_at" integer, "refresh_token_expires_at" integer, "scope" text, "password" text, "created_at" integer NOT NULL, "updated_at" integer NOT NULL, FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE cascade);',
    'CREATE INDEX "account_userId_idx" ON "account" ("user_id");',
    'CREATE TABLE "session" ("id" text PRIMARY KEY NOT NULL, "expires_at" integer NOT NULL, "token" text NOT NULL, "created_at" integer NOT NULL, "updated_at" integer NOT NULL, "ip_address" text, "user_agent" text, "user_id" text NOT NULL, FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE cascade);',
    'CREATE UNIQUE INDEX "session_token_unique" ON "session" ("token");',
    'CREATE INDEX "session_userId_idx" ON "session" ("user_id");',
    'CREATE TABLE "verification" ("id" text PRIMARY KEY NOT NULL, "identifier" text NOT NULL, "value" text NOT NULL, "expires_at" integer NOT NULL, "created_at" integer NOT NULL, "updated_at" integer NOT NULL);',
    'CREATE INDEX "verification_identifier_idx" ON "verification" ("identifier");',
  ]);

  return {
    database,
    linkingDatabase,

    createId(prefix: string) {
      let counter = 0;
      return () => `${prefix}-${counter++}`;
    },

    async createTestUser(id: string, email: string, name = "Test User") {
      const now = Date.now();
      await database.insert(user).values({
        id,
        email,
        emailVerified: true,
        image: null,
        name,
        createdAt: new Date(now),
        updatedAt: new Date(now),
      });

      return { id, email, name };
    },

    async createTestAccount(
      userId: string,
      providerId: string,
      accountId: string,
      options: { password?: string } = {},
    ) {
      const now = Date.now();
      await database.insert(account).values({
        id: `account-${providerId}-${accountId}`,
        accountId,
        providerId,
        userId,
        password: options.password,
        createdAt: new Date(now),
        updatedAt: new Date(now),
      });
    },

    async findAccountsForUser(userId: string) {
      return await database.select().from(account).where(eq(account.userId, userId));
    },

    async cleanup() {
      await database.$client.close();
      await unlink(databasePath).catch(() => undefined);
    },
  };
}
