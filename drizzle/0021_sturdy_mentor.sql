ALTER TABLE "user_permissions" DROP CONSTRAINT "user_permissions_origin_department_id_departments_id_fk";
--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "tokens_revoked_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "user_permissions" DROP COLUMN "source";--> statement-breakpoint
ALTER TABLE "user_permissions" DROP COLUMN "origin_department_id";--> statement-breakpoint
DROP TYPE "public"."permission_source";