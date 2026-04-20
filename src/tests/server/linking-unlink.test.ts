// @vitest-environment node

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getLinkedProviders, linkProvider, unlinkProvider } from "~/server/auth/linking";
import {
  createLinkingTestContext,
  type LinkingTestContext,
} from "~/tests/server/linking-test-utils";

let context: LinkingTestContext;

beforeEach(async () => {
  context = await createLinkingTestContext();
});

afterEach(async () => {
  await context.cleanup();
});

describe("account linking service - unlink", () => {
  it("removes a linked provider from the user account", async () => {
    const testUser = await context.createTestUser("user-1", "ada@example.com");
    const generateId = context.createId("account");

    await linkProvider(
      {
        userId: testUser.id,
        provider: "discord",
        providerAccountId: "discord-123",
        type: "oauth",
      },
      { createId: generateId, database: context.linkingDatabase },
    );

    await linkProvider(
      {
        userId: testUser.id,
        provider: "google",
        providerAccountId: "google-456",
        type: "oauth",
      },
      { createId: generateId, database: context.linkingDatabase },
    );

    await unlinkProvider(
      {
        userId: testUser.id,
        provider: "discord",
        providerAccountId: "discord-123",
      },
      { database: context.linkingDatabase },
    );

    const providers = await getLinkedProviders(testUser.id, {
      database: context.linkingDatabase,
    });

    expect(providers).toHaveLength(1);
    expect(providers[0]?.provider).toBe("google");
  });

  it("throws when trying to unlink a provider that is not linked", async () => {
    const testUser = await context.createTestUser("user-1", "ada@example.com");

    await expect(
      unlinkProvider(
        {
          userId: testUser.id,
          provider: "discord",
          providerAccountId: "discord-123",
        },
        { database: context.linkingDatabase },
      ),
    ).rejects.toThrow(/not linked/i);
  });

  it("prevents unlinking if user has no other auth methods", async () => {
    const testUser = await context.createTestUser("user-1", "ada@example.com");
    const generateId = context.createId("account");

    await linkProvider(
      {
        userId: testUser.id,
        provider: "discord",
        providerAccountId: "discord-123",
        type: "oauth",
      },
      { createId: generateId, database: context.linkingDatabase },
    );

    await expect(
      unlinkProvider(
        {
          userId: testUser.id,
          provider: "discord",
          providerAccountId: "discord-123",
        },
        { database: context.linkingDatabase },
      ),
    ).rejects.toThrow(/cannot remove your last authentication method/i);

    await expect(
      getLinkedProviders(testUser.id, { database: context.linkingDatabase }),
    ).resolves.toEqual([
      expect.objectContaining({
        provider: "discord",
        providerAccountId: "discord-123",
        userId: testUser.id,
      }),
    ]);
  });

  it("allows unlinking when user has a credential account", async () => {
    const testUser = await context.createTestUser("user-1", "ada@example.com");
    const generateId = context.createId("account");

    await context.createTestAccount(testUser.id, "credential", testUser.id, {
      password: "hashed-password",
    });

    await linkProvider(
      {
        userId: testUser.id,
        provider: "discord",
        providerAccountId: "discord-123",
        type: "oauth",
      },
      { createId: generateId, database: context.linkingDatabase },
    );

    await unlinkProvider(
      {
        userId: testUser.id,
        provider: "discord",
        providerAccountId: "discord-123",
      },
      { database: context.linkingDatabase },
    );

    const providers = await getLinkedProviders(testUser.id, {
      database: context.linkingDatabase,
    });

    expect(providers).toHaveLength(0);
  });

  it("allows unlinking when user has multiple oauth providers", async () => {
    const testUser = await context.createTestUser("user-1", "ada@example.com");
    const generateId = context.createId("account");

    await linkProvider(
      {
        userId: testUser.id,
        provider: "discord",
        providerAccountId: "discord-123",
        type: "oauth",
      },
      { createId: generateId, database: context.linkingDatabase },
    );

    await linkProvider(
      {
        userId: testUser.id,
        provider: "google",
        providerAccountId: "google-456",
        type: "oauth",
      },
      { createId: generateId, database: context.linkingDatabase },
    );

    await unlinkProvider(
      {
        userId: testUser.id,
        provider: "discord",
        providerAccountId: "discord-123",
      },
      { database: context.linkingDatabase },
    );

    const providers = await getLinkedProviders(testUser.id, {
      database: context.linkingDatabase,
    });

    expect(providers).toHaveLength(1);
    expect(providers[0]?.provider).toBe("google");
  });
});
