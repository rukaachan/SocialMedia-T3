import { eq, sql } from "drizzle-orm";
import { db, schemaReady } from "~/db";
import { session, user } from "~/db/schema";
import { getId, type JsonObject, omitUndefined, withStoredDate } from "./helpers";

export const sessionModel = {
  async findUnique(args: { where: { sessionToken: string }; include?: { user?: boolean } }) {
    await schemaReady;
    const rows = await db
      .select({ session, user: args.include?.user ? user : sql<null>`null` })
      .from(session)
      .leftJoin(user, eq(session.userId, user.id))
      .where(eq(session.sessionToken, args.where.sessionToken))
      .limit(1);

    const row = rows[0];
    if (row == null) return null;

    const sessionRecord = {
      ...row.session,
      expires: new Date(row.session.expires),
    };

    return args.include?.user ? { ...sessionRecord, user: row.user } : sessionRecord;
  },

  async create(args: { data: JsonObject }) {
    await schemaReady;
    const data = withStoredDate(args.data, "expires");
    const record = {
      expires: data.expires as string,
      id: getId(data.id),
      sessionToken: data.sessionToken as string,
      userId: data.userId as string,
    };

    await db.insert(session).values(record);
    return { ...record, expires: new Date(record.expires) };
  },

  async update(args: { where: { sessionToken: string }; data?: JsonObject } & JsonObject) {
    await schemaReady;
    const data = withStoredDate((args.data ?? {}) as JsonObject, "expires");
    const updates = omitUndefined({
      expires: data.expires as string | undefined,
      sessionToken: data.sessionToken as string | undefined,
      userId: data.userId as string | undefined,
    });

    await db.update(session).set(updates).where(eq(session.sessionToken, args.where.sessionToken));

    return await this.findUnique({ where: args.where });
  },

  async delete(args: { where: { sessionToken: string } }) {
    await schemaReady;
    const existing = await this.findUnique({ where: args.where });
    if (existing == null) return null;

    await db.delete(session).where(eq(session.sessionToken, args.where.sessionToken));
    return existing;
  },
};
