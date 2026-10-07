CREATE TABLE `requests` (
	`id` text PRIMARY KEY NOT NULL,
	`actor` text NOT NULL,
	`hash` text NOT NULL,
	`operation_token` text NOT NULL,
	`response` text NOT NULL,
	`created_at` text NOT NULL
);
