ALTER TABLE `records` ADD `dedupe_key` text;--> statement-breakpoint
CREATE UNIQUE INDEX `records_dedupe` ON `records` (`kind`,`dedupe_key`);