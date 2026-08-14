import { and, asc, desc, eq, inArray, isNull, lt, lte, or, sql } from "drizzle-orm";
import { db, schemaReady } from "~/db";
import { bookmark, like, mediaAsset, tweet, user } from "~/db/schema";
import { mediaUrl } from "~/server/platform/media";
import { serializeMedia } from "./tweet-queries";

export type TweetCursor = { id: string; createdAt: Date };

function serializeUser(row: {
  userId: string;
  userAvatarKey: string | null;
  userImage: string | null;
  userName: string | null;
}) {
  return {
    id: row.userId,
    image: mediaUrl(row.userAvatarKey) ?? row.userImage,
    name: row.userName,
  };
}

function serializeTweet(
  row: {
    id: string;
    content: string;
    parentId: string | null;
    createdAt: string;
    updatedAt: string;
    deletedAt: string | null;
    likeCount: number;
    likedByMe: number;
    bookmarkedByMe: number;
    replyCount: number;
    userId: string;
    userAvatarKey: string | null;
    userImage: string | null;
    userName: string | null;
  },
  media: (typeof mediaAsset.$inferSelect)[],
) {
  const deleted = row.deletedAt != null;
  return {
    id: row.id,
    content: deleted ? "" : row.content,
    parentId: row.parentId,
    createdAt: new Date(row.createdAt),
    updatedAt: new Date(row.updatedAt),
    deletedAt: row.deletedAt == null ? null : new Date(row.deletedAt),
    isDeleted: deleted,
    likeCount: Number(row.likeCount),
    likedByMe: Boolean(row.likedByMe),
    bookmarkedByMe: Boolean(row.bookmarkedByMe),
    replyCount: Number(row.replyCount),
    media: deleted ? [] : media.map(serializeMedia),
    user: serializeUser(row),
  };
}

export async function loadMedia(tweetIds: string[]) {
  if (tweetIds.length === 0) return new Map<string, (typeof mediaAsset.$inferSelect)[]>();
  const rows = await db
    .select()
    .from(mediaAsset)
    .where(
      and(
        inArray(mediaAsset.tweetId, tweetIds),
        eq(mediaAsset.status, "attached"),
        isNull(mediaAsset.deletedAt),
      ),
    )
    .orderBy(asc(mediaAsset.sortOrder), asc(mediaAsset.id));
  const grouped = new Map<string, typeof rows>();
  for (const row of rows) {
    const items = grouped.get(row.tweetId!) ?? [];
    items.push(row);
    grouped.set(row.tweetId!, items);
  }
  return grouped;
}

function replyCountSql() {
  return sql<number>`(
    select count(*) from "tweet" as reply
    where reply."parentId" = ${tweet.id}
      and reply."deletedAt" is null
  )`;
}

export async function getTweetById(id: string, currentUserId?: string) {
  await schemaReady;
  const rows = await db
    .select({
      id: tweet.id,
      content: tweet.content,
      parentId: tweet.parentId,
      createdAt: tweet.createdAt,
      updatedAt: tweet.updatedAt,
      deletedAt: tweet.deletedAt,
      likeCount: sql<number>`(
        select count(*) from ${like} where ${like.tweetId} = ${tweet.id}
      )`,
      likedByMe:
        currentUserId == null
          ? sql<number>`0`
          : sql<number>`exists(
              select 1 from ${like}
              where ${like.tweetId} = ${tweet.id}
                and ${like.userId} = ${currentUserId}
            )`,
      bookmarkedByMe:
        currentUserId == null
          ? sql<number>`0`
          : sql<number>`exists(
              select 1 from ${bookmark}
              where ${bookmark.tweetId} = ${tweet.id}
                and ${bookmark.userId} = ${currentUserId}
            )`,
      replyCount: replyCountSql(),
      userId: user.id,
      userAvatarKey: user.avatarKey,
      userImage: user.image,
      userName: user.name,
    })
    .from(tweet)
    .innerJoin(user, eq(tweet.userId, user.id))
    .where(eq(tweet.id, id))
    .limit(1);
  const row = rows[0];
  if (row == null) return;

  const media = await loadMedia([row.id]);
  return serializeTweet(row, media.get(row.id) ?? []);
}

export async function getInfiniteReplies(input: {
  tweetId: string;
  currentUserId?: string;
  limit: number;
  cursor?: TweetCursor;
}) {
  await schemaReady;
  const cursorCreatedAt = input.cursor?.createdAt.toISOString();
  const rows = await db
    .select({
      id: tweet.id,
      content: tweet.content,
      parentId: tweet.parentId,
      createdAt: tweet.createdAt,
      updatedAt: tweet.updatedAt,
      deletedAt: tweet.deletedAt,
      likeCount: sql<number>`(
        select count(*) from ${like} where ${like.tweetId} = ${tweet.id}
      )`,
      likedByMe:
        input.currentUserId == null
          ? sql<number>`0`
          : sql<number>`exists(
              select 1 from ${like}
              where ${like.tweetId} = ${tweet.id}
                and ${like.userId} = ${input.currentUserId}
            )`,
      replyCount: sql<number>`0`,
      bookmarkedByMe:
        input.currentUserId == null
          ? sql<number>`0`
          : sql<number>`exists(
              select 1 from ${bookmark}
              where ${bookmark.tweetId} = ${tweet.id}
                and ${bookmark.userId} = ${input.currentUserId}
            )`,
      userId: user.id,
      userAvatarKey: user.avatarKey,
      userImage: user.image,
      userName: user.name,
    })
    .from(tweet)
    .innerJoin(user, eq(tweet.userId, user.id))
    .where(
      and(
        eq(tweet.parentId, input.tweetId),
        cursorCreatedAt == null
          ? undefined
          : or(
              lt(tweet.createdAt, cursorCreatedAt),
              and(eq(tweet.createdAt, cursorCreatedAt), lte(tweet.id, input.cursor!.id)),
            ),
      ),
    )
    .orderBy(desc(tweet.createdAt), desc(tweet.id))
    .limit(input.limit + 1);

  let nextCursor: TweetCursor | undefined;
  if (rows.length > input.limit) {
    const nextItem = rows.pop();
    if (nextItem != null) {
      nextCursor = {
        id: nextItem.id,
        createdAt: new Date(nextItem.createdAt),
      };
    }
  }

  const media = await loadMedia(rows.filter((row) => row.deletedAt == null).map((row) => row.id));
  return {
    tweets: rows.map((row) => serializeTweet(row, media.get(row.id) ?? [])),
    nextCursor,
  };
}
