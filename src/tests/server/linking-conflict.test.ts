// @vitest-environment node

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { detectProviderConflict } from "~/server/auth/linking";
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

describe("account linking service - conflict detection", () => {
  it("returns no conflict when email is not in use", async () => {
    const conflict = await detectProviderConflict(
      {
        email: "new@example.com",
        provider: "discord",
        providerAccountId: "discord-123",
      },
      { database: context.linkingDatabase },
    );

    expect(conflict).toEqual({ hasConflict: false });
  });

  it("detects conflict when email exists with a different provider", async () => {
    const testUser = await context.createTestUser("user-1", "ada@example.com");
    await context.createTestAccount(testUser.id, "google", "google-456");

    const conflict = await detectProviderConflict(
      {
        email: "ada@example.com",
        provider: "discord",
        providerAccountId: "discord-123",
      },
      { database: context.linkingDatabase },
    );

    expect(conflict).toEqual({
      hasConflict: true,
      existingUserId: testUser.id,
      existingEmail: "ada@example.com",
      message: expect.stringMatching(/already exists/i),
    });
  });

  it("returns no conflict when provider is already linked to the same user", async () => {
    const testUser = await context.createTestUser("user-1", "ada@example.com");
    await context.createTestAccount(testUser.id, "discord", "discord-123");

    const conflict = await detectProviderConflict(
      {
        email: "ada@example.com",
        provider: "discord",
        providerAccountId: "discord-123",
      },
      { database: context.linkingDatabase },
    );

    expect(conflict).toEqual({ hasConflict: false });
  });

  it("detects conflict when email exists with a credential account", async () => {
    const testUser = await context.createTestUser("user-1", "ada@example.com");
    await context.createTestAccount(testUser.id, "credential", testUser.id, {
      password: "hashed-password",
    });

    const conflict = await detectProviderConflict(
      {
        email: "ada@example.com",
        provider: "discord",
        providerAccountId: "discord-123",
      },
      { database: context.linkingDatabase },
    );

    expect(conflict).toEqual({
      hasConflict: true,
      existingUserId: testUser.id,
      existingEmail: "ada@example.com",
      message: expect.stringMatching(/password/i),
    });
  });

  it("provides guidance message for explicit linking requirement", async () => {
    const testUser = await context.createTestUser("user-1", "ada@example.com");
    await context.createTestAccount(testUser.id, "google", "google-456");

    const conflict = await detectProviderConflict(
      {
        email: "ada@example.com",
        provider: "discord",
        providerAccountId: "discord-123",
      },
      { database: context.linkingDatabase },
    );

    expect(conflict.hasConflict).toBe(true);
    if (conflict.hasConflict) {
      expect(conflict.message).toMatch(/sign in/i);
      expect(conflict.message).toMatch(/link/i);
    }
  });
});
