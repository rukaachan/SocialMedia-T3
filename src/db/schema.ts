/* eslint-disable max-lines */

import { relations } from "drizzle-orm";
import {
  type AnySQLiteColumn,
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

export const user = sqliteTable(
  "user",
  {
    id: text("id").primaryKey(),
    name: text("name"),
    email: text("email"),
    emailVerified: text("emailVerified"),
    image: text("image"),
    bio: text("bio"),
    avatarKey: text("avatarKey"),
    createdAt: text("createdAt").notNull(),
    updatedAt: text("updatedAt").notNull(),
  },
  (table) => [uniqueIndex("user_email_idx").on(table.email)],
);

export const account = sqliteTable(
  "account",
  {
    id: text("id").primaryKey(),
    userId: text("userId")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("providerAccountId").notNull(),
    refreshToken: text("refreshToken"),
    accessToken: text("accessToken"),
    expiresAt: integer("expiresAt"),
    tokenType: text("tokenType"),
    scope: text("scope"),
    idToken: text("idToken"),
    sessionState: text("sessionState"),
  },
  (table) => [
    uniqueIndex("account_provider_account_idx").on(table.provider, table.providerAccountId),
    index("account_user_idx").on(table.userId),
  ],
);

export const session = sqliteTable(
  "session",
  {
    id: text("id").primaryKey(),
    sessionToken: text("sessionToken").notNull(),
    userId: text("userId")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    expires: text("expires").notNull(),
  },
  (table) => [
    uniqueIndex("session_token_idx").on(table.sessionToken),
    index("session_user_idx").on(table.userId),
  ],
);

export const verificationToken = sqliteTable(
  "verificationToken",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: text("expires").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.identifier, table.token] }),
    uniqueIndex("verification_token_idx").on(table.token),
  ],
);

export const credential = sqliteTable(
  "credential",
  {
    id: text("id").primaryKey(),
    userId: text("userId")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    hashedPassword: text("hashedPassword").notNull(),
  },
  (table) => [uniqueIndex("credential_user_idx").on(table.userId)],
);

export const passwordResetToken = sqliteTable(
  "passwordResetToken",
  {
    id: text("id").primaryKey(),
    userId: text("userId")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    token: text("token").notNull(),
    expires: text("expires").notNull(),
    usedAt: text("usedAt"),
  },
  (table) => [
    uniqueIndex("password_reset_token_idx").on(table.token),
    index("password_reset_user_idx").on(table.userId),
  ],
);

export const tweet = sqliteTable(
  "tweet",
  {
    id: text("id").primaryKey(),
    userId: text("userId")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    content: text("content").notNull(),
    parentId: text("parentId").references((): AnySQLiteColumn => tweet.id, {
      onDelete: "set null",
    }),
    createdAt: text("createdAt").notNull(),
    updatedAt: text("updatedAt").notNull(),
    deletedAt: text("deletedAt"),
  },
  (table) => [
    uniqueIndex("tweet_created_at_id_idx").on(table.createdAt, table.id),
    index("tweet_user_idx").on(table.userId),
    index("tweet_parent_created_at_idx").on(table.parentId, table.createdAt),
    index("tweet_deleted_at_idx").on(table.deletedAt),
  ],
);

export const like = sqliteTable(
  "like",
  {
    userId: text("userId")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    tweetId: text("tweetId")
      .notNull()
      .references(() => tweet.id, { onDelete: "cascade" }),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.tweetId] }),
    index("like_user_idx").on(table.userId),
    index("like_tweet_idx").on(table.tweetId),
  ],
);

export const userFollower = sqliteTable(
  "userFollower",
  {
    followingId: text("followingId")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    followerId: text("followerId")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (table) => [
    primaryKey({ columns: [table.followingId, table.followerId] }),
    index("user_follower_following_idx").on(table.followingId),
    index("user_follower_follower_idx").on(table.followerId),
  ],
);

export const mediaAsset = sqliteTable(
  "mediaAsset",
  {
    id: text("id").primaryKey(),
    ownerId: text("ownerId")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    tweetId: text("tweetId").references(() => tweet.id, {
      onDelete: "cascade",
    }),
    objectKey: text("objectKey").notNull(),
    purpose: text("purpose").notNull(),
    status: text("status").default("pending").notNull(),
    mimeType: text("mimeType").notNull(),
    byteSize: integer("byteSize").notNull(),
    width: integer("width").notNull(),
    height: integer("height").notNull(),
    sortOrder: integer("sortOrder").default(0).notNull(),
    altText: text("altText"),
    createdAt: text("createdAt").notNull(),
    attachedAt: text("attachedAt"),
    deletedAt: text("deletedAt"),
  },
  (table) => [
    uniqueIndex("media_asset_object_key_idx").on(table.objectKey),
    index("media_asset_owner_idx").on(table.ownerId),
    index("media_asset_tweet_idx").on(table.tweetId, table.sortOrder),
    index("media_asset_status_created_at_idx").on(table.status, table.createdAt),
  ],
);

export const bookmark = sqliteTable(
  "bookmark",
  {
    userId: text("userId")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    tweetId: text("tweetId")
      .notNull()
      .references(() => tweet.id, { onDelete: "cascade" }),
    createdAt: text("createdAt").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.tweetId] }),
    index("bookmark_user_created_at_idx").on(table.userId, table.createdAt),
    index("bookmark_tweet_idx").on(table.tweetId),
  ],
);

export const userRelations = relations(user, ({ many, one }) => ({
  accounts: many(account),
  sessions: many(session),
  tweets: many(tweet),
  likes: many(like),
  credential: one(credential),
  passwordResetTokens: many(passwordResetToken),
  mediaAssets: many(mediaAsset),
  bookmarks: many(bookmark),
  followers: many(userFollower, { relationName: "user_followers_following" }),
  follows: many(userFollower, { relationName: "user_followers_follower" }),
}));

export const accountRelations = relations(account, ({ one }) => ({
  user: one(user, {
    fields: [account.userId],
    references: [user.id],
  }),
}));

export const sessionRelations = relations(session, ({ one }) => ({
  user: one(user, {
    fields: [session.userId],
    references: [user.id],
  }),
}));

export const credentialRelations = relations(credential, ({ one }) => ({
  user: one(user, {
    fields: [credential.userId],
    references: [user.id],
  }),
}));

export const passwordResetTokenRelations = relations(passwordResetToken, ({ one }) => ({
  user: one(user, {
    fields: [passwordResetToken.userId],
    references: [user.id],
  }),
}));

export const tweetRelations = relations(tweet, ({ many, one }) => ({
  user: one(user, {
    fields: [tweet.userId],
    references: [user.id],
  }),
  parent: one(tweet, {
    fields: [tweet.parentId],
    references: [tweet.id],
    relationName: "tweet_thread",
  }),
  replies: many(tweet, { relationName: "tweet_thread" }),
  likes: many(like),
  mediaAssets: many(mediaAsset),
  bookmarks: many(bookmark),
}));

export const likeRelations = relations(like, ({ one }) => ({
  user: one(user, {
    fields: [like.userId],
    references: [user.id],
  }),
  tweet: one(tweet, {
    fields: [like.tweetId],
    references: [tweet.id],
  }),
}));

export const userFollowerRelations = relations(userFollower, ({ one }) => ({
  following: one(user, {
    fields: [userFollower.followingId],
    references: [user.id],
    relationName: "user_followers_following",
  }),
  follower: one(user, {
    fields: [userFollower.followerId],
    references: [user.id],
    relationName: "user_followers_follower",
  }),
}));

export const mediaAssetRelations = relations(mediaAsset, ({ one }) => ({
  owner: one(user, {
    fields: [mediaAsset.ownerId],
    references: [user.id],
  }),
  tweet: one(tweet, {
    fields: [mediaAsset.tweetId],
    references: [tweet.id],
  }),
}));

export const bookmarkRelations = relations(bookmark, ({ one }) => ({
  user: one(user, {
    fields: [bookmark.userId],
    references: [user.id],
  }),
  tweet: one(tweet, {
    fields: [bookmark.tweetId],
    references: [tweet.id],
  }),
}));
