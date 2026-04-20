// @ts-nocheck

import { computeAuthInvariants, computeCoreInvariants } from "./reports.mjs";
import { iso, selectAll } from "./helpers.mjs";

export function mapSourceRows(snapshot) {
  return {
    user: snapshot.users.map((entry) => ({
      id: entry.id,
      name: entry.name ?? null,
      email: entry.email ?? null,
      emailVerified: iso(entry.emailVerified),
      image: entry.image ?? null,
      createdAt: iso(entry.createdAt),
      updatedAt: iso(entry.updatedAt ?? entry.createdAt),
    })),
    account: snapshot.accounts.map((entry) => ({
      id: entry.id,
      userId: entry.userId,
      type: entry.type,
      provider: entry.provider,
      providerAccountId: entry.providerAccountId,
      refreshToken: entry.refresh_token ?? null,
      accessToken: entry.access_token ?? null,
      expiresAt: entry.expires_at ?? null,
      tokenType: entry.token_type ?? null,
      scope: entry.scope ?? null,
      idToken: entry.id_token ?? null,
      sessionState: entry.session_state ?? null,
    })),
    session: snapshot.sessions.map((entry) => ({
      id: entry.id,
      sessionToken: entry.sessionToken,
      userId: entry.userId,
      expires: iso(entry.expires),
    })),
    verificationToken: snapshot.verificationTokens.map((entry) => ({
      identifier: entry.identifier,
      token: entry.token,
      expires: iso(entry.expires),
    })),
    tweet: snapshot.tweets.map((entry) => ({
      id: entry.id,
      userId: entry.userId,
      content: entry.content,
      createdAt: iso(entry.createdAt),
    })),
    like: snapshot.likes.map((entry) => ({
      userId: entry.userId,
      tweetId: entry.tweetId,
    })),
    userFollower: snapshot.userFollowers.map((entry) => ({
      followingId: entry.followingId,
      followerId: entry.followerId,
    })),
  };
}

export async function loadSourceSnapshot(prisma) {
  const [users, accounts, sessions, verificationTokens, tweets, likes, follows] = await Promise.all(
    [
      prisma.user.findMany(),
      prisma.account.findMany(),
      prisma.session.findMany(),
      prisma.verificationToken.findMany(),
      prisma.tweet.findMany(),
      prisma.like.findMany(),
      prisma.user.findMany({
        select: {
          id: true,
          follows: {
            select: {
              id: true,
            },
          },
        },
      }),
    ],
  );

  const userFollowers = follows.flatMap((entry) =>
    entry.follows.map((follow) => ({
      followingId: follow.id,
      followerId: entry.id,
    })),
  );

  const snapshot = {
    users,
    accounts,
    sessions,
    verificationTokens,
    tweets,
    likes,
    userFollowers,
    credentials: [],
    passwordResetTokens: [],
  };

  return {
    counts: {
      users: users.length,
      accounts: accounts.length,
      sessions: sessions.length,
      verificationTokens: verificationTokens.length,
      tweets: tweets.length,
      likes: likes.length,
      userFollowers: userFollowers.length,
      credentials: 0,
      passwordResetTokens: 0,
    },
    invariants: computeCoreInvariants(snapshot),
    rows: snapshot,
  };
}

export async function loadTargetSnapshot(client) {
  const [
    users,
    accounts,
    sessions,
    verificationTokens,
    credentials,
    passwordResetTokens,
    tweets,
    likes,
    userFollowers,
  ] = await Promise.all([
    selectAll(
      client,
      'SELECT id, name, email, emailVerified, image, createdAt, updatedAt FROM "user"',
    ),
    selectAll(
      client,
      'SELECT id, userId, type, provider, providerAccountId, refreshToken, accessToken, expiresAt, tokenType, scope, idToken, sessionState FROM "account"',
    ),
    selectAll(client, 'SELECT id, sessionToken, userId, expires FROM "session"'),
    selectAll(client, 'SELECT identifier, token, expires FROM "verificationToken"'),
    selectAll(client, 'SELECT id, userId, hashedPassword FROM "credential"'),
    selectAll(client, 'SELECT id, userId, token, expires, usedAt FROM "passwordResetToken"'),
    selectAll(client, 'SELECT id, userId, content, createdAt FROM "tweet"'),
    selectAll(client, 'SELECT userId, tweetId FROM "like"'),
    selectAll(client, 'SELECT followingId, followerId FROM "userFollower"'),
  ]);

  const snapshot = {
    users,
    accounts,
    sessions,
    verificationTokens,
    credentials,
    passwordResetTokens,
    tweets,
    likes,
    userFollowers,
  };

  return {
    counts: {
      users: users.length,
      accounts: accounts.length,
      sessions: sessions.length,
      verificationTokens: verificationTokens.length,
      credentials: credentials.length,
      passwordResetTokens: passwordResetTokens.length,
      tweets: tweets.length,
      likes: likes.length,
      userFollowers: userFollowers.length,
    },
    invariants: computeCoreInvariants(snapshot),
    authInvariants: computeAuthInvariants(snapshot),
    rows: snapshot,
  };
}
