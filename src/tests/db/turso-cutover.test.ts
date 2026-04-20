// @vitest-environment node

import { describe, expect, it } from "vitest";
import { createClient } from "@libsql/client";

import {
  buildAuthIntegrityReport,
  buildParityReport,
  ensureTursoSchema,
} from "../../../scripts/db/lib/cutover.mjs";

describe("MySQL to Turso cutover reports", () => {
  it("flags parity mismatches and preserves composite-key invariants", () => {
    const report = buildParityReport({
      source: {
        counts: {
          accounts: 2,
          likes: 3,
          sessions: 1,
          tweets: 4,
          users: 2,
          userFollowers: 2,
          verificationTokens: 1,
        },
        invariants: {
          danglingLikes: 0,
          duplicateLikeKeys: 0,
          duplicateTweetOrderKeys: 0,
          missingFollowUsers: 0,
          orphanedAccounts: 0,
          orphanedSessions: 0,
          orphanedTweets: 0,
          orphanedVerificationTokens: 0,
        },
      },
      target: {
        counts: {
          accounts: 2,
          likes: 2,
          sessions: 1,
          tweets: 4,
          users: 2,
          userFollowers: 2,
          verificationTokens: 1,
        },
        invariants: {
          danglingLikes: 0,
          duplicateLikeKeys: 0,
          duplicateTweetOrderKeys: 0,
          missingFollowUsers: 0,
          orphanedAccounts: 1,
          orphanedSessions: 0,
          orphanedTweets: 0,
          orphanedVerificationTokens: 0,
        },
      },
      generatedAt: "2026-03-23T00:00:00.000Z",
      sourceLabel: "mysql",
      targetLabel: "turso",
    });

    expect(report.ok).toBe(false);
    expect(report.summary).toEqual([
      "Count mismatch for likes: mysql=3, turso=2",
      "Invariant mismatch for orphanedAccounts: mysql=0, turso=1",
    ]);
    expect(report.markdown).toContain("| likes | 3 | 2 | mismatch |");
    expect(report.markdown).toContain(
      "| orphanedAccounts | 0 | 1 | mismatch |"
    );
    expect(report.markdown).toContain("task-11-data-parity");
  });

  it("marks auth integrity healthy when identities are not orphaned", () => {
    const report = buildAuthIntegrityReport({
      counts: {
        accounts: 2,
        credentials: 0,
        passwordResetTokens: 0,
        sessions: 1,
        users: 2,
        verificationTokens: 1,
      },
      generatedAt: "2026-03-23T00:00:00.000Z",
      invariants: {
        credentialUsersMissing: 0,
        duplicateAccountProviderPairs: 0,
        orphanedAccounts: 0,
        orphanedPasswordResetTokens: 0,
        orphanedSessions: 0,
        orphanedVerificationTokens: 0,
      },
      sourceLabel: "turso",
    });

    expect(report.ok).toBe(true);
    expect(report.summary).toEqual(["All auth integrity checks passed."]);
    expect(report.markdown).toContain(
      "| duplicateAccountProviderPairs | 0 | ok |"
    );
    expect(report.markdown).toContain("| orphanedSessions | 0 | ok |");
    expect(report.markdown).toContain("task-11-auth-integrity");
  });

  it("applies the checked-in Turso schema idempotently", async () => {
    const client = createClient({ url: ":memory:" });

    try {
      await ensureTursoSchema(client);
      await ensureTursoSchema(client);
    } finally {
      await client.close();
    }
  });
});
