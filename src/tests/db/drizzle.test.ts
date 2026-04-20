// @vitest-environment node

import { getTableColumns, getTableName } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import drizzleConfig from "../../../drizzle.config";
import { db } from "~/db";
import {
  account,
  credential,
  like,
  passwordResetToken,
  session,
  tweet,
  user,
  userFollower,
  verificationToken,
} from "~/db/schema";

describe("Drizzle Turso wiring", () => {
  it("defines the expected Turso migration config", () => {
    expect(drizzleConfig).toMatchObject({
      dialect: "turso",
      schema: "./src/db/schema.ts",
      out: "./src/db/migrations",
    });
  });

  it("exports the expected social and auth tables", () => {
    expect(getTableName(user)).toBe("user");
    expect(getTableName(account)).toBe("account");
    expect(getTableName(session)).toBe("session");
    expect(getTableName(verificationToken)).toBe("verificationToken");
    expect(getTableName(credential)).toBe("credential");
    expect(getTableName(passwordResetToken)).toBe("passwordResetToken");
    expect(getTableName(tweet)).toBe("tweet");
    expect(getTableName(like)).toBe("like");
    expect(getTableName(userFollower)).toBe("userFollower");
  });

  it("exposes stable pagination and join columns", () => {
    expect(Object.keys(getTableColumns(tweet))).toEqual(
      expect.arrayContaining(["id", "userId", "content", "createdAt"])
    );
    expect(Object.keys(getTableColumns(like))).toEqual(
      expect.arrayContaining(["userId", "tweetId"])
    );
    expect(Object.keys(getTableColumns(userFollower))).toEqual(
      expect.arrayContaining(["followingId", "followerId"])
    );
  });

  it("creates a typed Drizzle database instance", () => {
    expect(db).toBeDefined();
  });
});
