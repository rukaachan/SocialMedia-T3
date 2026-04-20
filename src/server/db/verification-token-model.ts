import { and, eq } from "drizzle-orm";
import { db, schemaReady } from "~/db";
import { verificationToken } from "~/db/schema";
import { type JsonObject, withStoredDate } from "./helpers";

export const verificationTokenModel = {
  async create(args: { data: JsonObject }) {
    await schemaReady;
    const data = withStoredDate(args.data, "expires");
    const record = {
      expires: data.expires as string,
      identifier: data.identifier as string,
      token: data.token as string,
    };

    await db.insert(verificationToken).values(record);
    return { ...record, expires: new Date(record.expires) };
  },

  async delete(args: { where: { identifier_token: { identifier: string; token: string } } }) {
    await schemaReady;
    const key = args.where.identifier_token;
    const existing = await db.query.verificationToken.findFirst({
      where: and(
        eq(verificationToken.identifier, key.identifier),
        eq(verificationToken.token, key.token),
      ),
    });

    if (existing == null) return null;

    await db
      .delete(verificationToken)
      .where(
        and(
          eq(verificationToken.identifier, key.identifier),
          eq(verificationToken.token, key.token),
        ),
      );

    return { ...existing, expires: new Date(existing.expires) };
  },
};
