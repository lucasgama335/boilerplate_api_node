ALTER TABLE "department_permission_templates" RENAME TO "department_permissions";--> statement-breakpoint
ALTER TABLE "department_permissions" DROP CONSTRAINT "department_permission_templates_department_id_departments_id_fk";
--> statement-breakpoint
ALTER TABLE "department_permissions" DROP CONSTRAINT "department_permission_templates_permission_id_permissions_id_fk";
--> statement-breakpoint
DROP INDEX "department_permission_templates_department_id_permission_id_idx";--> statement-breakpoint
ALTER TABLE "department_permissions" ADD CONSTRAINT "department_permissions_department_id_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "department_permissions" ADD CONSTRAINT "department_permissions_permission_id_permissions_id_fk" FOREIGN KEY ("permission_id") REFERENCES "public"."permissions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "department_permissions_department_id_permission_id_idx" ON "department_permissions" USING btree ("department_id","permission_id");