// @vitest-environment node

import { afterEach, describe, expect, it } from "vitest";
import type { AppSession } from "~/lib/auth/server";
import { appRouter } from "~/server/api/root";
import { createInnerTRPCContext } from "~/server/api/trpc";
import { prisma } from "~/server/db";

const createdUserIds = new Set<string>();
const createdTweetIds = new Set<string>();

function session(userId: string): AppSession {
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

function caller(currentSession: AppSession | null) {
  return appRouter.createCaller(createInnerTRPCContext({ session: currentSession }));
}

async function createUser(name: string) {
  const id = `bookmark-search-${name}-${crypto.randomUUID()}`;
  createdUserIds.add(id);
  return await prisma.user.create({
    data: {
      id,
      email: `${id}@example.com`,
      name,
      image: null,
    },
  });
}

afterEach(async () => {
  await prisma.tweet.deleteMany({ where: { id: { in: [...createdTweetIds] } } });
  await prisma.user.deleteMany({ where: { id: { in: [...createdUserIds] } } });
  createdTweetIds.clear();
  createdUserIds.clear();
});

describe("bookmark and bounded search procedures", () => {
  it("toggles bookmarks and lists only the current user's saved posts", async () => {
    const author = await createUser("bookmark-author");
    const viewer = await createUser("bookmark-viewer");
    const tweet = await prisma.tweet.create({
      data: {
        id: `bookmark-tweet-${crypto.randomUUID()}`,
        content: "Save this post",
        userId: author.id,
      },
    });
    createdTweetIds.add(tweet.id);

    const viewerCaller = caller(session(viewer.id));
    await expect(viewerCaller.bookmark.toggle({ tweetId: tweet.id })).resolves.toEqual({
      addedBookmark: true,
    });
    await expect(viewerCaller.bookmark.infiniteMine({})).resolves.toMatchObject({
      tweets: [expect.objectContaining({ id: tweet.id, bookmarkedByMe: true })],
    });
    await expect(viewerCaller.bookmark.toggle({ tweetId: tweet.id })).resolves.toEqual({
      addedBookmark: false,
    });
    await expect(viewerCaller.bookmark.infiniteMine({})).resolves.toMatchObject({
      tweets: [],
    });
  });

  it("searches bounded user names and top-level post content", async () => {
    const author = await createUser("needle-author");
    const tweet = await prisma.tweet.create({
      data: {
        id: `search-tweet-${crypto.randomUUID()}`,
        content: "A unique needle phrase",
        userId: author.id,
      },
    });
    createdTweetIds.add(tweet.id);

    const result = await caller(null).search.all({ q: "needle" });
    expect(result.users).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: author.id })]),
    );
    expect(result.tweets).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: tweet.id })]),
    );
  });
});
