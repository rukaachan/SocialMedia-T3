import { and, eq, inArray, or, sql } from "drizzle-orm";
import { db, schemaReady } from "~/db";
import { user, userFollower } from "~/db/schema";
import {
  clearFollowersForUser,
  clearFollowsForUser,
  combineWhere,
  getId,
  nowIso,
  omitUndefined,
  type JsonObject,
  toStoredDate,
} from "./helpers";

export const userModel = {
  async create(args: { data: JsonObject }) {
    await schemaReady;
    const now = nowIso();
    const data = args.data;
    const record = {
      createdAt: now,
      email: (data.email as string | null | undefined) ?? null,
      emailVerified: toStoredDate(data.emailVerified),
      id: getId(data.id),
      image: (data.image as string | null | undefined) ?? null,
      name: (data.name as string | null | undefined) ?? null,
      updatedAt: now,
    };

    await db.insert(user).values(record);
    return record;
  },

  async findUnique(args: { where: JsonObject }) {
    await schemaReady;
    const where = args.where;

    if (typeof where.id === "string") {
      return await db.query.user.findFirst({ where: eq(user.id, where.id) });
    }

    if (typeof where.email === "string") {
      return await db.query.user.findFirst({ where: eq(user.email, where.email) });
    }

    return null;
  },

  async findFirst(args: { where?: JsonObject }) {
    await schemaReady;
    const where = args.where;
    const filters = [] as Array<ReturnType<typeof eq> | ReturnType<typeof sql>>;

    if (typeof where?.id === "string") {
      filters.push(eq(user.id, where.id));
    }

    if (typeof where?.email === "string") {
      filters.push(eq(user.email, where.email));
    }

    const followerId = (where?.followers as { some?: { id?: string } } | undefined)?.some?.id;

    if (typeof followerId === "string") {
      filters.push(
        sql`exists(select 1 from "userFollower" where "userFollower"."followingId" = "user"."id" and "userFollower"."followerId" = ${followerId})`,
      );
    }

    return (
      (await db.query.user.findFirst({
        where: combineWhere(filters),
      })) ?? null
    );
  },

  async update(args: { where: { id: string }; data?: JsonObject } & JsonObject) {
    await schemaReady;
    const userId = args.where.id;
    const data = (args.data ?? {}) as JsonObject;
    const updates = omitUndefined({
      email: (data.email as string | null | undefined) ?? undefined,
      emailVerified:
        data.emailVerified === undefined ? undefined : toStoredDate(data.emailVerified),
      image: (data.image as string | null | undefined) ?? undefined,
      name: (data.name as string | null | undefined) ?? undefined,
      updatedAt: nowIso(),
    });

    await db.transaction(async (tx) => {
      if (Object.keys(updates).length > 0) {
        await tx.update(user).set(updates).where(eq(user.id, userId));
      }

      const followers = data.followers as
        | { connect?: { id?: string }; disconnect?: { id?: string }; set?: unknown[] }
        | undefined;

      if (followers?.set != null) {
        await tx.delete(userFollower).where(eq(userFollower.followingId, userId));
      }

      if (typeof followers?.connect?.id === "string") {
        await tx
          .insert(userFollower)
          .values({ followerId: followers.connect.id, followingId: userId })
          .onConflictDoNothing();
      }

      if (typeof followers?.disconnect?.id === "string") {
        await tx
          .delete(userFollower)
          .where(
            and(
              eq(userFollower.followingId, userId),
              eq(userFollower.followerId, followers.disconnect.id),
            ),
          );
      }

      const follows = data.follows as
        | { connect?: { id?: string }; disconnect?: { id?: string }; set?: unknown[] }
        | undefined;

      if (follows?.set != null) {
        await tx.delete(userFollower).where(eq(userFollower.followerId, userId));
      }

      if (typeof follows?.connect?.id === "string") {
        await tx
          .insert(userFollower)
          .values({ followerId: userId, followingId: follows.connect.id })
          .onConflictDoNothing();
      }

      if (typeof follows?.disconnect?.id === "string") {
        await tx
          .delete(userFollower)
          .where(
            and(
              eq(userFollower.followerId, userId),
              eq(userFollower.followingId, follows.disconnect.id),
            ),
          );
      }
    });

    return await db.query.user.findFirst({ where: eq(user.id, userId) });
  },

  async delete(args: { where: { id: string } }) {
    await schemaReady;
    const existing = await db.query.user.findFirst({ where: eq(user.id, args.where.id) });
    if (existing == null) return null;

    await clearFollowersForUser(args.where.id);
    await clearFollowsForUser(args.where.id);
    await db.delete(user).where(eq(user.id, args.where.id));

    return existing;
  },

  async deleteMany(args: { where?: { id?: { in?: string[] } } }) {
    await schemaReady;
    const ids = args.where?.id?.in ?? [];
    if (ids.length === 0) return { count: 0 };

    await db
      .delete(userFollower)
      .where(or(inArray(userFollower.followingId, ids), inArray(userFollower.followerId, ids)));

    const result = await db.delete(user).where(inArray(user.id, ids));
    return { count: Number(result.rowsAffected ?? 0) };
  },
};
