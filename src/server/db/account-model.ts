import { and, eq, sql } from "drizzle-orm";
import { db, schemaReady } from "~/db";
import { account, user } from "~/db/schema";
import { getId, type JsonObject } from "./helpers";

export const accountModel = {
  async create(args: { data: JsonObject }) {
    await schemaReady;
    const data = args.data;
    const record = {
      accessToken: (data.accessToken as string | null | undefined) ?? null,
      expiresAt:
        typeof data.expiresAt === "number" ? data.expiresAt : (data.expires_at as number | null),
      id: getId(data.id),
      idToken: (data.idToken as string | null | undefined) ?? null,
      provider: data.provider as string,
      providerAccountId: data.providerAccountId as string,
      refreshToken: (data.refreshToken as string | null | undefined) ?? null,
      scope: (data.scope as string | null | undefined) ?? null,
      sessionState: (data.sessionState as string | null | undefined) ?? null,
      tokenType: (data.tokenType as string | null | undefined) ?? null,
      type: data.type as string,
      userId: data.userId as string,
    };

    await db.insert(account).values(record);
    return record;
  },

  async findUnique(args: {
    where: {
      provider_providerAccountId: {
        provider: string;
        providerAccountId: string;
      };
    };
    include?: { user?: boolean };
  }) {
    await schemaReady;
    const key = args.where.provider_providerAccountId;
    const rows = await db
      .select({ account, user: args.include?.user ? user : sql<null>`null` })
      .from(account)
      .leftJoin(user, eq(account.userId, user.id))
      .where(
        and(
          eq(account.provider, key.provider),
          eq(account.providerAccountId, key.providerAccountId),
        ),
      )
      .limit(1);

    const row = rows[0];
    if (row == null) return null;

    return args.include?.user ? { ...row.account, user: row.user } : row.account;
  },

  async findFirst(args: { where: { provider: string; providerAccountId: string } }) {
    await schemaReady;
    return await db.query.account.findFirst({
      where: and(
        eq(account.provider, args.where.provider),
        eq(account.providerAccountId, args.where.providerAccountId),
      ),
    });
  },

  async delete(args: {
    where: {
      provider_providerAccountId: {
        provider: string;
        providerAccountId: string;
      };
    };
  }) {
    await schemaReady;
    const key = args.where.provider_providerAccountId;
    const existing = await db.query.account.findFirst({
      where: and(
        eq(account.provider, key.provider),
        eq(account.providerAccountId, key.providerAccountId),
      ),
    });

    if (existing == null) return null;

    await db
      .delete(account)
      .where(
        and(
          eq(account.provider, key.provider),
          eq(account.providerAccountId, key.providerAccountId),
        ),
      );

    return existing;
  },
};
