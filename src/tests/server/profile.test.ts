// @vitest-environment node

import { afterEach, describe, expect, it } from "vitest";
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
  const id = `profile-test-${label}-${crypto.randomUUID()}`;
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

async function createTweet(userId: string, label: string) {
  const id = `profile-tweet-${label}-${crypto.randomUUID()}`;
  createdTweetIds.add(id);

  return await prisma.tweet.create({
    data: {
      id,
      content: `tweet-${label}`,
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
  await prisma.user.deleteMany({ where: { id: { in: [...createdUserIds] } } });

  createdTweetIds.clear();
  createdUserIds.clear();
});

describe("src/server/api/routers/profile.ts", () => {
  it("returns profile counts and current-user follow state", async () => {
    const target = await createUser("target");
    const viewer = await createUser("viewer");
    const otherFollow = await createUser("other-follow");
    const followedAccount = await createUser("followed-account");

    await createTweet(target.id, "one");
    await createTweet(target.id, "two");
    await prisma.user.update({
      where: { id: target.id },
      data: { followers: { connect: { id: otherFollow.id } } },
    });
    await prisma.user.update({
      where: { id: target.id },
      data: { follows: { connect: { id: followedAccount.id } } },
    });

    const anonymousCaller = createCaller(null);

    await expect(anonymousCaller.profile.getById({ id: target.id })).rejects.toThrow(/length/);

    await prisma.user.update({
      where: { id: target.id },
      data: { followers: { connect: { id: viewer.id } } },
    });

    const authedCaller = createCaller(createSession(viewer.id));
    const authedProfile = await authedCaller.profile.getById({ id: target.id });

    expect(authedProfile).toMatchObject({
      name: "target",
      followersCount: 2,
      followsCount: 1,
      tweetsCount: 2,
      isFollowing: true,
    });
  }, 20_000);

  it("connects and disconnects followers through toggleFollow", async () => {
    const target = await createUser("target");
    const viewer = await createUser("viewer");
    const caller = createCaller(createSession(viewer.id));

    await expect(caller.profile.toggleFollow({ userId: target.id })).resolves.toEqual({
      addedFollow: true,
    });

    const afterFollow = await caller.profile.getById({ id: target.id });
    expect(afterFollow).toMatchObject({
      followersCount: 1,
      isFollowing: true,
    });
    await expect(
      prisma.user.findFirst({
        where: { id: target.id, followers: { some: { id: viewer.id } } },
      }),
    ).resolves.not.toBeNull();

    await expect(caller.profile.toggleFollow({ userId: target.id })).resolves.toEqual({
      addedFollow: false,
    });

    const afterUnfollow = await caller.profile.getById({ id: target.id });
    expect(afterUnfollow).toMatchObject({
      followersCount: 0,
      isFollowing: false,
    });
    await expect(
      prisma.user.findFirst({
        where: { id: target.id, followers: { some: { id: viewer.id } } },
      }),
    ).resolves.toBeNull();
  });
});
