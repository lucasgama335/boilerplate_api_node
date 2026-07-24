ALTER TABLE "login_attempts" ADD COLUMN "city" text;--> statement-breakpoint
ALTER TABLE "login_attempts" ADD COLUMN "region" text;--> statement-breakpoint
ALTER TABLE "login_attempts" ADD COLUMN "country" text;--> statement-breakpoint
ALTER TABLE "login_attempts" ADD COLUMN "browser" text;--> statement-breakpoint
ALTER TABLE "login_attempts" ADD COLUMN "os" text;--> statement-breakpoint
ALTER TABLE "login_attempts" ADD COLUMN "device_type" text;--> statement-breakpoint
ALTER TABLE "refresh_tokens" ADD COLUMN "city" text;--> statement-breakpoint
ALTER TABLE "refresh_tokens" ADD COLUMN "region" text;--> statement-breakpoint
ALTER TABLE "refresh_tokens" ADD COLUMN "country" text;--> statement-breakpoint
ALTER TABLE "refresh_tokens" ADD COLUMN "browser" text;--> statement-breakpoint
ALTER TABLE "refresh_tokens" ADD COLUMN "os" text;--> statement-breakpoint
ALTER TABLE "refresh_tokens" ADD COLUMN "device_type" text;