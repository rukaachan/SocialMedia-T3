// @vitest-environment node
/* eslint-disable max-lines */

import { afterEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db, schemaReady } from "~/db";
import { mediaAsset } from "~/db/schema";
import type { AppSession } from "~/lib/auth/server";
import { appRouter } from "~/server/api/root";
import { createInnerTRPCContext } from "~/server/api/trpc";
import { prisma } from "~/server/db";
import { createNoopCacheInvalidation } from "~/server/platform/cache-invalidation";

const createdUserIds = new Set<string>();
const createdTweetIds = new Set<string>();

function createSession(userId: string): AppSession {
  return {
    expires: new Date(Date.now() + 60_000).toISOString(),
    user: {
      id: userId,
      createdAt: new Date(0),
      updatedAt: new Date(0),
      email: `${userId}@example.com`,
      emailVerified: false,
      name: userId,
      image: null,
    },
  };
}

function createCaller(session: AppSession | null) {
  return appRouter.createCaller(
    createInnerTRPCContext({
      cacheInvalidation: createNoopCacheInvalidation(),
      session,
    }),
  );
}

async function createUser(label: string) {
  const id = `tweet-test-${label}-${crypto.randomUUID()}`;
  createdUserIds.add(id);

  return await prisma.user.create({
    data: {
      id,
      email: `${id}@example.com`,
      name: label,
      image: `https://example.com/${id}.png`,
    },
  });
}

async function createTweet(userId: string, label: string, createdAt: Date) {
  const id = `tweet-${label}-${crypto.randomUUID()}`;
  createdTweetIds.add(id);

  return await prisma.tweet.create({
    data: {
      id,
      content: `content-${label}`,
      createdAt,
      userId,
    },
  });
}

afterEach(async () => {
  await prisma.like.deleteMany({
    where: {
      OR: [{ tweetId: { in: [...createdTweetIds] } }, { userId: { in: [...createdUserIds] } }],
    },
  });

  for (const userId of createdUserIds) {
    await prisma.user
      .update({
        where: { id: userId },
        data: { followers: { set: [] }, follows: { set: [] } },
      })
      .catch(() => undefined);
  }

  await prisma.tweet.deleteMany({
    where: { id: { in: [...createdTweetIds] } },
  });
  for (const userId of createdUserIds) {
    await db.delete(mediaAsset).where(eq(mediaAsset.ownerId, userId));
  }
  await prisma.user.deleteMany({ where: { id: { in: [...createdUserIds] } } });

  createdTweetIds.clear();
  createdUserIds.clear();
});

describe("src/server/api/routers/tweet.ts", () => {
  it("orders feed pages by createdAt desc then id desc without duplicating across cursors", async () => {
    const author = await createUser("author");
    const createdAt = new Date("2024-01-01T00:00:00.000Z");

    const tweetA = await createTweet(author.id, "a", createdAt);
    const tweetB = await createTweet(author.id, "b", createdAt);
    const tweetC = await createTweet(author.id, "c", createdAt);
    const tweetD = await createTweet(author.id, "d", createdAt);

    const caller = createCaller(null);

    const firstPage = await caller.tweet.infiteProfile({
      limit: 2,
      userId: author.id,
    });

    expect(firstPage.tweets.map((tweet) => tweet.id)).toEqual(
      [tweetD.id, tweetC.id, tweetB.id, tweetA.id]
        .sort((left, right) => right.localeCompare(left))
        .slice(0, 2),
    );
    expect(firstPage.nextCursor).toEqual({
      createdAt,
      id: [tweetD.id, tweetC.id, tweetB.id, tweetA.id].sort((left, right) =>
        right.localeCompare(left),
      )[2],
    });

    const secondPage = await caller.tweet.infiteProfile({
      cursor: firstPage.nextCursor,
      limit: 2,
      userId: author.id,
    });

    expect(secondPage.tweets.map((tweet) => tweet.id)).toEqual(
      [tweetD.id, tweetC.id, tweetB.id, tweetA.id]
        .sort((left, right) => right.localeCompare(left))
        .slice(2),
    );
    expect(secondPage.nextCursor).toBeUndefined();
  });

  it("attaches owned pending media and returns media metadata in the created post", async () => {
    await schemaReady;
    const author = await createUser("media-author");
    const mediaId = `media-${crypto.randomUUID()}`;
    await db.insert(mediaAsset).values({
      id: mediaId,
      ownerId: author.id,
      objectKey: `media/${mediaId}.png`,
      purpose: "post",
      status: "pending",
      mimeType: "image/png",
      byteSize: 128,
      width: 320,
      height: 180,
      sortOrder: 0,
      altText: "A test image",
      createdAt: new Date().toISOString(),
    });

    const caller = createCaller(createSession(author.id));
    const created = await caller.tweet.create({
      content: "A post with an image",
      mediaIds: [mediaId],
    });
    createdTweetIds.add(created.id);

    expect(created.media).toMatchObject([
      {
        id: mediaId,
        url: `/api/media/media/${mediaId}.png`,
        width: 320,
        height: 180,
        altText: "A test image",
      },
    ]);
    await expect(
      db.query.mediaAsset.findFirst({ where: eq(mediaAsset.id, mediaId) }),
    ).resolves.toMatchObject({
      tweetId: created.id,
      status: "attached",
    });
  });

  it("allows only the owner to edit or soft-delete a post", async () => {
    const author = await createUser("owner");
    const other = await createUser("other");
    const original = await createTweet(
      author.id,
      "lifecycle",
      new Date("2024-03-01T00:00:00.000Z"),
    );
    const authorCaller = createCaller(createSession(author.id));
    const otherCaller = createCaller(createSession(other.id));

    await expect(
      otherCaller.tweet.update({ id: original.id, content: "not allowed" }),
    ).rejects.toThrow("only manage your own posts");

    const updated = await authorCaller.tweet.update({
      id: original.id,
      content: "updated content",
    });
    expect(updated).toMatchObject({ id: original.id, content: "updated content" });

    await expect(authorCaller.tweet.delete({ id: original.id })).resolves.toMatchObject({
      id: original.id,
    });
    await expect(
      authorCaller.tweet.infiteProfile({ userId: author.id, limit: 10 }),
    ).resolves.toMatchObject({ tweets: [] });
  });

  it("creates single-level replies, paginates them, and keeps deleted replies as tombstones", async () => {
    const author = await createUser("thread-author");
    const viewer = await createUser("thread-viewer");
    const root = await createTweet(author.id, "thread-root", new Date("2024-04-01T00:00:00.000Z"));
    const viewerCaller = createCaller(createSession(viewer.id));
    const authorCaller = createCaller(createSession(author.id));

    const firstReply = await viewerCaller.tweet.reply({
      parentId: root.id,
      content: "First reply",
    });
    const secondReply = await authorCaller.tweet.reply({
      parentId: root.id,
      content: "Second reply",
    });
    createdTweetIds.add(firstReply.id);
    createdTweetIds.add(secondReply.id);

    await expect(
      viewerCaller.tweet.reply({
        parentId: firstReply.id,
        content: "Nested reply",
      }),
    ).rejects.toThrow("top-level");

    await expect(viewerCaller.tweet.getById({ id: root.id })).resolves.toMatchObject({
      id: root.id,
      replyCount: 2,
    });
    const replies = await viewerCaller.tweet.infiniteReplies({
      tweetId: root.id,
      limit: 10,
    });
    expect(replies.tweets.map((item) => item.id)).toEqual(
      expect.arrayContaining([firstReply.id, secondReply.id]),
    );

    await authorCaller.tweet.delete({ id: secondReply.id });
    await expect(
      viewerCaller.tweet.infiniteReplies({ tweetId: root.id, limit: 10 }),
    ).resolves.toMatchObject({
      tweets: expect.arrayContaining([
        expect.objectContaining({ id: secondReply.id, isDeleted: true, content: "" }),
      ]),
    });
  });

  it("toggles likes and reflects likedByMe and likeCount in the feed", async () => {
    const author = await createUser("author");
    const viewer = await createUser("viewer");
    const tweet = await createTweet(author.id, "like-target", new Date("2024-02-01T00:00:00.000Z"));

    const caller = createCaller(createSession(viewer.id));

    const beforeToggle = await caller.tweet.infiteProfile({
      limit: 10,
      userId: author.id,
    });
    expect(beforeToggle.tweets.find((entry) => entry.id === tweet.id)).toMatchObject({
      id: tweet.id,
      likeCount: 0,
      likedByMe: false,
    });

    await expect(caller.tweet.toggleLike({ id: tweet.id })).resolves.toEqual({
      addedLike: true,
    });
    await expect(
      prisma.like.findUnique({
        where: { userId_tweetId: { tweetId: tweet.id, userId: viewer.id } },
      }),
    ).resolves.not.toBeNull();

    const afterLike = await caller.tweet.infiteProfile({
      limit: 10,
      userId: author.id,
    });
    expect(afterLike.tweets.find((entry) => entry.id === tweet.id)).toMatchObject({
      id: tweet.id,
      likeCount: 1,
      likedByMe: true,
    });

    await expect(caller.tweet.toggleLike({ id: tweet.id })).resolves.toEqual({
      addedLike: false,
    });
    await expect(
      prisma.like.findUnique({
        where: { userId_tweetId: { tweetId: tweet.id, userId: viewer.id } },
      }),
    ).resolves.toBeNull();

    const afterUnlike = await caller.tweet.infiteProfile({
      limit: 10,
      userId: author.id,
    });
    expect(afterUnlike.tweets.find((entry) => entry.id === tweet.id)).toMatchObject({
      id: tweet.id,
      likeCount: 0,
      likedByMe: false,
    });
  });
});
