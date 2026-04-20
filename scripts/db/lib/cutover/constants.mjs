// @ts-nocheck

import path from "node:path";

export const PARITY_COUNT_KEYS = [
  "users",
  "accounts",
  "sessions",
  "verificationTokens",
  "tweets",
  "likes",
  "userFollowers",
];

export const PARITY_INVARIANT_KEYS = [
  "orphanedAccounts",
  "orphanedSessions",
  "orphanedVerificationTokens",
  "orphanedTweets",
  "danglingLikes",
  "missingFollowUsers",
  "duplicateLikeKeys",
  "duplicateTweetOrderKeys",
];

export const AUTH_COUNT_KEYS = [
  "users",
  "accounts",
  "sessions",
  "verificationTokens",
  "credentials",
  "passwordResetTokens",
];

export const AUTH_INVARIANT_KEYS = [
  "orphanedAccounts",
  "orphanedSessions",
  "orphanedVerificationTokens",
  "credentialUsersMissing",
  "orphanedPasswordResetTokens",
  "duplicateAccountProviderPairs",
];

export const TARGET_CLEAR_ORDER = [
  "like",
  "userFollower",
  "passwordResetToken",
  "credential",
  "session",
  "verificationToken",
  "account",
  "tweet",
  "user",
];

export const DEFAULT_MIGRATION_SQL_PATH = path.resolve(
  process.cwd(),
  "src/db/migrations/0000_dark_starhawk.sql",
);

export const DEFAULT_PARITY_PATH = path.resolve(
  process.cwd(),
  ".sisyphus/evidence/task-11-data-parity.md",
);

export const DEFAULT_AUTH_PATH = path.resolve(
  process.cwd(),
  ".sisyphus/evidence/task-11-auth-integrity.md",
);
