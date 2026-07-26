ALTER TABLE "users" ALTER COLUMN "is_super_user" SET NOT NULL;--> statement-breakpoint
DROP TYPE "public"."permission_source";