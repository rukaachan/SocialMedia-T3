CREATE TABLE `bookmark` (
	`userId` text NOT NULL,
	`tweetId` text NOT NULL,
	`createdAt` text NOT NULL,
	PRIMARY KEY(`userId`, `tweetId`),
	FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`tweetId`) REFERENCES `tweet`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `bookmark_user_created_at_idx` ON `bookmark` (`userId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `bookmark_tweet_idx` ON `bookmark` (`tweetId`);--> statement-breakpoint
CREATE TABLE `mediaAsset` (
	`id` text PRIMARY KEY NOT NULL,
	`ownerId` text NOT NULL,
	`tweetId` text,
	`objectKey` text NOT NULL,
	`purpose` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`mimeType` text NOT NULL,
	`byteSize` integer NOT NULL,
	`width` integer NOT NULL,
	`height` integer NOT NULL,
	`sortOrder` integer DEFAULT 0 NOT NULL,
	`altText` text,
	`createdAt` text NOT NULL,
	`attachedAt` text,
	`deletedAt` text,
	FOREIGN KEY (`ownerId`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`tweetId`) REFERENCES `tweet`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `media_asset_object_key_idx` ON `mediaAsset` (`objectKey`);--> statement-breakpoint
CREATE INDEX `media_asset_owner_idx` ON `mediaAsset` (`ownerId`);--> statement-breakpoint
CREATE INDEX `media_asset_tweet_idx` ON `mediaAsset` (`tweetId`,`sortOrder`);--> statement-breakpoint
CREATE INDEX `media_asset_status_created_at_idx` ON `mediaAsset` (`status`,`createdAt`);--> statement-breakpoint
ALTER TABLE `tweet` ADD `parentId` text REFERENCES tweet(id) ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE `tweet` ADD `updatedAt` text NOT NULL DEFAULT '';--> statement-breakpoint
UPDATE `tweet` SET `updatedAt` = `createdAt` WHERE `updatedAt` = '';--> statement-breakpoint
ALTER TABLE `tweet` ADD `deletedAt` text;--> statement-breakpoint
CREATE INDEX `tweet_parent_created_at_idx` ON `tweet` (`parentId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `tweet_deleted_at_idx` ON `tweet` (`deletedAt`);--> statement-breakpoint
ALTER TABLE `user` ADD `bio` text;--> statement-breakpoint
ALTER TABLE `user` ADD `avatarKey` text;