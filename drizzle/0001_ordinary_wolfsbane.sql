CREATE TYPE "public"."login_attempt_status" AS ENUM('success', 'fail');--> statement-breakpoint
CREATE TABLE "login_attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"role" "login_attempt_status" NOT NULL,
	"ip_address" "inet",
	"created_at" timestamp DEFAULT now() NOT NULL
);
