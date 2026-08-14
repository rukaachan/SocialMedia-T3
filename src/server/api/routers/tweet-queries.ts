import { and, asc, desc, eq, inArray, isNull, lt, lte, or, sql } from "drizzle-orm";
import { db, schemaReady } from "~/db";
import { bookmark, like, mediaAsset, tweet, user, userFollower } from "~/db/schema";
import { mediaUrl } from "~/server/platform/media";

function combineFilters(filters: Array<any | undefined>) {
  const activeFilters = filters.filter((filter): filter is any => filter != null);

  if (activeFilters.length === 0) return undefined;
  if (activeFilters.length === 1) return activeFilters[0];

  return and(...activeFilters);
}

export async function getInfiniteTweets({
  currentUserId,
  cursor,
  limit,
  onlyFollowing = false,
  userId,
}: {
  currentUserId?: string;
  cursor?: { id: string; createdAt: Date };
  limit: number;
  onlyFollowing?: boolean;
  userId?: string;
}) {
  await schemaReady;
  const cursorCreatedAt = cursor?.createdAt.toISOString();
  const rows = await db
    .select({
      content: tweet.content,
      createdAt: tweet.createdAt,
      id: tweet.id,
      updatedAt: tweet.updatedAt,
      replyCount: sql<number>`(
        select count(*) from "tweet" as reply
        where reply."parentId" = ${tweet.id}
          and reply."deletedAt" is null
      )`,
      likeCount: sql<number>`(
        select count(*) from ${like} where ${like.tweetId} = ${tweet.id}
      )`,
      likedByMe:
        currentUserId == null
          ? sql<number>`0`
          : sql<number>`exists(
              select 1 from ${like}
              where ${like.tweetId} = ${tweet.id} and ${like.userId} = ${currentUserId}
            )`,
      bookmarkedByMe:
        currentUserId == null
          ? sql<number>`0`
          : sql<number>`exists(
              select 1 from ${bookmark}
              where ${bookmark.tweetId} = ${tweet.id} and ${bookmark.userId} = ${currentUserId}
            )`,
      userAvatarKey: user.avatarKey,
      userId: user.id,
      userImage: user.image,
      userName: user.name,
    })
    .from(tweet)
    .innerJoin(user, eq(tweet.userId, user.id))
    .where(
      combineFilters([
        userId == null ? undefined : eq(tweet.userId, userId),
        isNull(tweet.parentId),
        isNull(tweet.deletedAt),
        currentUserId == null || !onlyFollowing
          ? undefined
          : sql`exists(
              select 1 from ${userFollower}
              where ${userFollower.followingId} = ${tweet.userId}
                and ${userFollower.followerId} = ${currentUserId}
            )`,
        cursorCreatedAt == null
          ? undefined
          : or(
              lt(tweet.createdAt, cursorCreatedAt),
              and(eq(tweet.createdAt, cursorCreatedAt), lte(tweet.id, cursor!.id)),
            ),
      ]),
    )
    .orderBy(desc(tweet.createdAt), desc(tweet.id))
    .limit(limit + 1);

  let nextCursor: { id: string; createdAt: Date } | undefined;
  if (rows.length > limit) {
    const nextItem = rows.pop();
    if (nextItem != null) {
      nextCursor = {
        createdAt: new Date(nextItem.createdAt),
        id: nextItem.id,
      };
    }
  }

  const mediaRows =
    rows.length === 0
      ? []
      : await db
          .select()
          .from(mediaAsset)
          .where(
            and(
              inArray(
                mediaAsset.tweetId,
                rows.map((row) => row.id),
              ),
              eq(mediaAsset.status, "attached"),
              isNull(mediaAsset.deletedAt),
            ),
          )
          .orderBy(asc(mediaAsset.sortOrder), asc(mediaAsset.id));
  const mediaByTweet = new Map<string, typeof mediaRows>();
  for (const media of mediaRows) {
    const items = mediaByTweet.get(media.tweetId!) ?? [];
    items.push(media);
    mediaByTweet.set(media.tweetId!, items);
  }

  return {
    tweets: rows.map((row) => ({
      content: row.content,
      createdAt: new Date(row.createdAt),
      id: row.id,
      updatedAt: new Date(row.updatedAt),
      likeCount: Number(row.likeCount),
      likedByMe: Boolean(row.likedByMe),
      bookmarkedByMe: Boolean(row.bookmarkedByMe),
      replyCount: Number(row.replyCount),
      media: (mediaByTweet.get(row.id) ?? []).map(serializeMedia),
      user: {
        id: row.userId,
        image: mediaUrl(row.userAvatarKey) ?? row.userImage,
        name: row.userName,
      },
    })),
    nextCursor,
  };
}

export function serializeMedia(asset: typeof mediaAsset.$inferSelect) {
  return {
    id: asset.id,
    url: `/api/media/${asset.objectKey}`,
    mimeType: asset.mimeType,
    byteSize: asset.byteSize,
    width: asset.width,
    height: asset.height,
    altText: asset.altText,
  };
}
