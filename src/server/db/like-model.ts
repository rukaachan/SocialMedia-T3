import { and, eq, inArray, or } from "drizzle-orm";
import { db, schemaReady } from "~/db";
import { like } from "~/db/schema";

export const likeModel = {
  async create(args: { data: { tweetId: string; userId: string } }) {
    await schemaReady;
    await db.insert(like).values(args.data);
    return args.data;
  },

  async findUnique(args: { where: { userId_tweetId: { tweetId: string; userId: string } } }) {
    await schemaReady;
    const data = args.where.userId_tweetId;

    return (
      (await db.query.like.findFirst({
        where: and(eq(like.tweetId, data.tweetId), eq(like.userId, data.userId)),
      })) ?? null
    );
  },

  async delete(args: { where: { userId_tweetId: { tweetId: string; userId: string } } }) {
    await schemaReady;
    const data = args.where.userId_tweetId;
    const existing = await db.query.like.findFirst({
      where: and(eq(like.tweetId, data.tweetId), eq(like.userId, data.userId)),
    });

    if (existing == null) return null;

    await db.delete(like).where(and(eq(like.tweetId, data.tweetId), eq(like.userId, data.userId)));

    return existing;
  },

  async deleteMany(args: {
    where?: {
      OR?: Array<{ tweetId?: { in?: string[] }; userId?: { in?: string[] } }>;
    };
  }) {
    await schemaReady;
    const tweetIds = new Set<string>();
    const userIds = new Set<string>();

    for (const entry of args.where?.OR ?? []) {
      for (const tweetId of entry.tweetId?.in ?? []) {
        tweetIds.add(tweetId);
      }

      for (const userId of entry.userId?.in ?? []) {
        userIds.add(userId);
      }
    }

    const filters = [] as Array<ReturnType<typeof inArray>>;
    if (tweetIds.size > 0) filters.push(inArray(like.tweetId, [...tweetIds]));
    if (userIds.size > 0) filters.push(inArray(like.userId, [...userIds]));

    if (filters.length === 0) {
      return { count: 0 };
    }

    const result = await db.delete(like).where(or(...filters));
    return { count: Number(result.rowsAffected ?? 0) };
  },
};
