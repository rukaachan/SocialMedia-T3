// @ts-nocheck

import {
  AUTH_COUNT_KEYS,
  AUTH_INVARIANT_KEYS,
  PARITY_COUNT_KEYS,
  PARITY_INVARIANT_KEYS,
} from "./constants.mjs";
import { buildTable, collectDuplicates, compareMetrics } from "./helpers.mjs";

export function computeCoreInvariants(snapshot) {
  const userIds = new Set(snapshot.users.map((entry) => entry.id));
  const tweetIds = new Set(snapshot.tweets.map((entry) => entry.id));

  return {
    orphanedAccounts: snapshot.accounts.filter((entry) => !userIds.has(entry.userId)).length,
    orphanedSessions: snapshot.sessions.filter((entry) => !userIds.has(entry.userId)).length,
    orphanedVerificationTokens: snapshot.verificationTokens.filter(
      (entry) => !userIds.has(entry.identifier),
    ).length,
    orphanedTweets: snapshot.tweets.filter((entry) => !userIds.has(entry.userId)).length,
    danglingLikes: snapshot.likes.filter(
      (entry) => !userIds.has(entry.userId) || !tweetIds.has(entry.tweetId),
    ).length,
    missingFollowUsers: snapshot.userFollowers.filter(
      (entry) => !userIds.has(entry.followingId) || !userIds.has(entry.followerId),
    ).length,
    duplicateLikeKeys: collectDuplicates(
      snapshot.likes.map((entry) => `${entry.userId}::${entry.tweetId}`),
    ),
    duplicateTweetOrderKeys: collectDuplicates(
      snapshot.tweets.map((entry) => `${entry.createdAt}::${entry.id}`),
    ),
  };
}

export function computeAuthInvariants(snapshot) {
  const userIds = new Set(snapshot.users.map((entry) => entry.id));

  return {
    orphanedAccounts: snapshot.accounts.filter((entry) => !userIds.has(entry.userId)).length,
    orphanedSessions: snapshot.sessions.filter((entry) => !userIds.has(entry.userId)).length,
    orphanedVerificationTokens: snapshot.verificationTokens.filter(
      (entry) => !userIds.has(entry.identifier),
    ).length,
    credentialUsersMissing: snapshot.credentials.filter((entry) => !userIds.has(entry.userId))
      .length,
    orphanedPasswordResetTokens: snapshot.passwordResetTokens.filter(
      (entry) => !userIds.has(entry.userId),
    ).length,
    duplicateAccountProviderPairs: collectDuplicates(
      snapshot.accounts.map((entry) => `${entry.provider}::${entry.providerAccountId}`),
    ),
  };
}

export function buildParityReport({ source, target, generatedAt, sourceLabel, targetLabel }) {
  const countMismatches = compareMetrics(PARITY_COUNT_KEYS, source.counts, target.counts);
  const invariantMismatches = compareMetrics(
    PARITY_INVARIANT_KEYS,
    source.invariants,
    target.invariants,
  );

  const summary = [
    ...countMismatches.map(
      (key) =>
        `Count mismatch for ${key}: ${sourceLabel}=${source.counts[key] ?? 0}, ${targetLabel}=${target.counts[key] ?? 0}`,
    ),
    ...invariantMismatches.map(
      (key) =>
        `Invariant mismatch for ${key}: ${sourceLabel}=${source.invariants[key] ?? 0}, ${targetLabel}=${target.invariants[key] ?? 0}`,
    ),
  ];

  const ok = summary.length === 0;
  const effectiveSummary = ok ? ["All parity checks passed."] : summary;
  const markdown = [
    "# task-11-data-parity",
    "",
    `Generated at: ${generatedAt}`,
    `Source: ${sourceLabel}`,
    `Target: ${targetLabel}`,
    `Status: ${ok ? "pass" : "fail"}`,
    "",
    "## Summary",
    ...effectiveSummary.map((entry) => `- ${entry}`),
    "",
    "## Count parity",
    buildTable([
      `| metric | ${sourceLabel} | ${targetLabel} | status |`,
      "| --- | ---: | ---: | --- |",
      ...PARITY_COUNT_KEYS.map((key) => {
        const sourceValue = source.counts[key] ?? 0;
        const targetValue = target.counts[key] ?? 0;
        return `| ${key} | ${sourceValue} | ${targetValue} | ${sourceValue === targetValue ? "ok" : "mismatch"} |`;
      }),
    ]),
    "",
    "## Invariant parity",
    buildTable([
      `| invariant | ${sourceLabel} | ${targetLabel} | status |`,
      "| --- | ---: | ---: | --- |",
      ...PARITY_INVARIANT_KEYS.map((key) => {
        const sourceValue = source.invariants[key] ?? 0;
        const targetValue = target.invariants[key] ?? 0;
        return `| ${key} | ${sourceValue} | ${targetValue} | ${sourceValue === targetValue ? "ok" : "mismatch"} |`;
      }),
    ]),
    "",
  ].join("\n");

  return { markdown, ok, summary: effectiveSummary };
}

export function buildAuthIntegrityReport({ counts, invariants, generatedAt, sourceLabel }) {
  const failing = AUTH_INVARIANT_KEYS.filter((key) => (invariants[key] ?? 0) !== 0);
  const summary =
    failing.length === 0
      ? ["All auth integrity checks passed."]
      : failing.map((key) => `Auth invariant failed for ${key}: ${invariants[key] ?? 0}`);

  const ok = failing.length === 0;
  const markdown = [
    "# task-11-auth-integrity",
    "",
    `Generated at: ${generatedAt}`,
    `Target: ${sourceLabel}`,
    `Status: ${ok ? "pass" : "fail"}`,
    "",
    "## Summary",
    ...summary.map((entry) => `- ${entry}`),
    "",
    "## Auth table counts",
    buildTable([
      `| metric | ${sourceLabel} |`,
      "| --- | ---: |",
      ...AUTH_COUNT_KEYS.map((key) => `| ${key} | ${counts[key] ?? 0} |`),
    ]),
    "",
    "## Auth invariants",
    buildTable([
      "| invariant | value | status |",
      "| --- | ---: | --- |",
      ...AUTH_INVARIANT_KEYS.map(
        (key) =>
          `| ${key} | ${invariants[key] ?? 0} | ${(invariants[key] ?? 0) === 0 ? "ok" : "fail"} |`,
      ),
    ]),
    "",
  ].join("\n");

  return { markdown, ok, summary };
}
