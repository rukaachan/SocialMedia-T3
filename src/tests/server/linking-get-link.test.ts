// @vitest-environment node

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getLinkedProviders, linkProvider } from "~/server/auth/linking";
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

describe("account linking service - get/link", () => {
  describe("getLinkedProviders", () => {
    it("returns empty array when user has no linked oauth providers", async () => {
      const testUser = await context.createTestUser("user-1", "ada@example.com");

      const providers = await getLinkedProviders(testUser.id, {
        database: context.linkingDatabase,
      });

      expect(providers).toEqual([]);
    });

    it("returns all non-credential providers linked to the user", async () => {
      const testUser = await context.createTestUser("user-1", "ada@example.com");
      await context.createTestAccount(testUser.id, "discord", "discord-123");
      await context.createTestAccount(testUser.id, "google", "google-456");
      await context.createTestAccount(testUser.id, "credential", testUser.id, {
        password: "hashed-password",
      });

      const providers = await getLinkedProviders(testUser.id, {
        database: context.linkingDatabase,
      });

      expect(providers).toHaveLength(2);
      expect(providers).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            provider: "discord",
            providerAccountId: "discord-123",
          }),
          expect.objectContaining({
            provider: "google",
            providerAccountId: "google-456",
          }),
        ]),
      );
    });
  });

  describe("linkProvider", () => {
    it("links a new oauth provider to an authenticated user account", async () => {
      const testUser = await context.createTestUser("user-1", "ada@example.com");
      const generateId = context.createId("account");

      const result = await linkProvider(
        {
          userId: testUser.id,
          provider: "discord",
          providerAccountId: "discord-789",
          type: "oauth",
        },
        { createId: generateId, database: context.linkingDatabase },
      );

      expect(result).toMatchObject({
        userId: testUser.id,
        provider: "discord",
        providerAccountId: "discord-789",
        type: "oauth",
      });

      const accounts = await context.findAccountsForUser(testUser.id);
      expect(accounts).toHaveLength(1);
      expect(accounts[0]).toMatchObject({
        providerId: "discord",
        accountId: "discord-789",
      });
    });

    it("allows linking multiple providers to the same user", async () => {
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

      const providers = await getLinkedProviders(testUser.id, {
        database: context.linkingDatabase,
      });
      expect(providers).toHaveLength(2);
    });

    it("rejects linking when provider is already linked to the same user", async () => {
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
        linkProvider(
          {
            userId: testUser.id,
            provider: "discord",
            providerAccountId: "discord-123",
            type: "oauth",
          },
          { createId: generateId, database: context.linkingDatabase },
        ),
      ).rejects.toThrow(/already linked/i);
    });

    it("rejects linking when provider account is linked to a different user", async () => {
      const user1 = await context.createTestUser("user-1", "ada@example.com");
      const user2 = await context.createTestUser("user-2", "bob@example.com");
      const generateId = context.createId("account");

      await linkProvider(
        {
          userId: user1.id,
          provider: "discord",
          providerAccountId: "discord-123",
          type: "oauth",
        },
        { createId: generateId, database: context.linkingDatabase },
      );

      await expect(
        linkProvider(
          {
            userId: user2.id,
            provider: "discord",
            providerAccountId: "discord-123",
            type: "oauth",
          },
          { createId: generateId, database: context.linkingDatabase },
        ),
      ).rejects.toThrow(/already linked to another account/i);
    });
  });
});
