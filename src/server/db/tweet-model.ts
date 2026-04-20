import { inArray } from "drizzle-orm";
import { db, schemaReady } from "~/db";
import { tweet } from "~/db/schema";
import { getId, type JsonObject, withStoredDate } from "./helpers";

export const tweetModel = {
  async create(args: { data: JsonObject }) {
    await schemaReady;
    const data = withStoredDate(args.data, "createdAt");
    const record = {
      content: (data.content as string | undefined) ?? "",
      createdAt: data.createdAt as string,
      id: getId(data.id),
      userId: data.userId as string,
    };

    await db.insert(tweet).values(record);
    return { ...record, createdAt: new Date(record.createdAt) };
  },

  async deleteMany(args: { where?: { id?: { in?: string[] } } }) {
    await schemaReady;
    const ids = args.where?.id?.in ?? [];
    if (ids.length === 0) return { count: 0 };

    const result = await db.delete(tweet).where(inArray(tweet.id, ids));
    return { count: Number(result.rowsAffected ?? 0) };
  },
};
