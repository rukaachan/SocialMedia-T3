// @vitest-environment node

import { createTRPCProxyClient, httpBatchLink } from "@trpc/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import superjson from "superjson";
import type { AppSession } from "~/lib/auth/server";
import type { AppRouter } from "~/server/api/root";
import { prisma } from "~/server/db";

const createdUserIds = new Set<string>();
const createdTweetIds = new Set<string>();
const getServerAuthSession = vi.fn<() => Promise<AppSession | null>>();

vi.mock("~/server/auth", async () => {
  const actual = await vi.importActual("~/server/auth");

  return {
    ...actual,
    getServerAuthSession,
  };
});

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

async function createUser(label: string) {
  const id = `trpc-fetch-${label}-${crypto.randomUUID()}`;
  createdUserIds.add(id);

  return await prisma.user.create({
    data: {
      id,
      email: `${id}@example.com`,
      image: `https://example.com/${id}.png`,
      name: label,
    },
  });
}

async function createTweet(userId: string, label: string) {
  const id = `trpc-fetch-tweet-${label}-${crypto.randomUUID()}`;
  createdTweetIds.add(id);

  return await prisma.tweet.create({
    data: {
      id,
      content: `tweet-${label}`,
      userId,
    },
  });
}

async function createTransportClient() {
  const routeModule = await import("~/app/api/trpc/[trpc]/route");

  return createTRPCProxyClient<AppRouter>({
    links: [
      httpBatchLink({
        fetch: async (url, init) => {
          const request = new Request(url, init);

          if (request.method === "GET") {
            return routeModule.GET(request);
          }

          if (request.method === "POST") {
            return routeModule.POST(request);
          }

          throw new Error(`Unsupported tRPC test method: ${request.method}`);
        },
        transformer: superjson,
        url: "http://localhost/api/trpc",
      }),
    ],
  });
}

beforeEach(() => {
  getServerAuthSession.mockReset();
  vi.resetModules();
});

afterEach(async () => {
  await prisma.like.deleteMany({
    where: {
      OR: [{ tweetId: { in: [...createdTweetIds] } }, { userId: { in: [...createdUserIds] } }],
    },
  });

  await prisma.tweet.deleteMany({
    where: { id: { in: [...createdTweetIds] } },
  });
  await prisma.user.deleteMany({ where: { id: { in: [...createdUserIds] } } });

  createdTweetIds.clear();
  createdUserIds.clear();
});

describe("src/app/api/trpc/[trpc]/route.ts", () => {
  it("serves public tRPC queries through the fetch route handler", async () => {
    const author = await createUser("author");
    const tweet = await createTweet(author.id, "public");
    getServerAuthSession.mockResolvedValue(null);

    const client = await createTransportClient();
    const result = await client.tweet.infiteProfile.query({
      limit: 10,
      userId: author.id,
    });

    expect(result.tweets).toEqual([
      expect.objectContaining({
        id: tweet.id,
      }),
    ]);
    expect(getServerAuthSession).toHaveBeenCalledOnce();
  }, 20_000);

  it("preserves authenticated session access for protected mutations", async () => {
    const author = await createUser("author");
    const viewer = await createUser("viewer");
    const tweet = await createTweet(author.id, "liked");
    getServerAuthSession.mockResolvedValue(createSession(viewer.id));

    const client = await createTransportClient();
    await expect(client.tweet.toggleLike.mutate({ id: tweet.id })).resolves.toEqual({
      addedLike: true,
    });

    await expect(
      prisma.like.findUnique({
        where: { userId_tweetId: { tweetId: tweet.id, userId: viewer.id } },
      }),
    ).resolves.not.toBeNull();
    expect(getServerAuthSession).toHaveBeenCalledOnce();
  }, 20_000);
});
