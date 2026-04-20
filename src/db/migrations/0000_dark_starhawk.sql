CREATE TABLE `account` (
	`id` text PRIMARY KEY NOT NULL,
	`userId` text NOT NULL,
	`type` text NOT NULL,
	`provider` text NOT NULL,
	`providerAccountId` text NOT NULL,
	`refreshToken` text,
	`accessToken` text,
	`expiresAt` integer,
	`tokenType` text,
	`scope` text,
	`idToken` text,
	`sessionState` text,
	FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `account_provider_account_idx` ON `account` (`provider`,`providerAccountId`);--> statement-breakpoint
CREATE INDEX `account_user_idx` ON `account` (`userId`);--> statement-breakpoint
CREATE TABLE `credential` (
	`id` text PRIMARY KEY NOT NULL,
	`userId` text NOT NULL,
	`hashedPassword` text NOT NULL,
	FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `credential_user_idx` ON `credential` (`userId`);--> statement-breakpoint
CREATE TABLE `like` (
	`userId` text NOT NULL,
	`tweetId` text NOT NULL,
	PRIMARY KEY(`userId`, `tweetId`),
	FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`tweetId`) REFERENCES `tweet`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `like_user_idx` ON `like` (`userId`);--> statement-breakpoint
CREATE INDEX `like_tweet_idx` ON `like` (`tweetId`);--> statement-breakpoint
CREATE TABLE `passwordResetToken` (
	`id` text PRIMARY KEY NOT NULL,
	`userId` text NOT NULL,
	`token` text NOT NULL,
	`expires` text NOT NULL,
	`usedAt` text,
	FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `password_reset_token_idx` ON `passwordResetToken` (`token`);--> statement-breakpoint
CREATE INDEX `password_reset_user_idx` ON `passwordResetToken` (`userId`);--> statement-breakpoint
CREATE TABLE `session` (
	`id` text PRIMARY KEY NOT NULL,
	`sessionToken` text NOT NULL,
	`userId` text NOT NULL,
	`expires` text NOT NULL,
	FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `session_token_idx` ON `session` (`sessionToken`);--> statement-breakpoint
CREATE INDEX `session_user_idx` ON `session` (`userId`);--> statement-breakpoint
CREATE TABLE `tweet` (
	`id` text PRIMARY KEY NOT NULL,
	`userId` text NOT NULL,
	`content` text NOT NULL,
	`createdAt` text NOT NULL,
	FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `tweet_created_at_id_idx` ON `tweet` (`createdAt`,`id`);--> statement-breakpoint
CREATE INDEX `tweet_user_idx` ON `tweet` (`userId`);--> statement-breakpoint
CREATE TABLE `user` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text,
	`email` text,
	`emailVerified` text,
	`image` text,
	`createdAt` text NOT NULL,
	`updatedAt` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_email_idx` ON `user` (`email`);--> statement-breakpoint
CREATE TABLE `userFollower` (
	`followingId` text NOT NULL,
	`followerId` text NOT NULL,
	PRIMARY KEY(`followingId`, `followerId`),
	FOREIGN KEY (`followingId`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`followerId`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `user_follower_following_idx` ON `userFollower` (`followingId`);--> statement-breakpoint
CREATE INDEX `user_follower_follower_idx` ON `userFollower` (`followerId`);--> statement-breakpoint
CREATE TABLE `verificationToken` (
	`identifier` text NOT NULL,
	`token` text NOT NULL,
	`expires` text NOT NULL,
	PRIMARY KEY(`identifier`, `token`)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `verification_token_idx` ON `verificationToken` (`token`);