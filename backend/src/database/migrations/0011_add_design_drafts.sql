-- Register Design wizard drafts: a design started on /add-designs but not yet registered, saved so
-- the Design Master dashboard can list it and the wizard can resume it at the step it was left on.
-- design_code / pattern_name / item_name are denormalized from `state` for the dashboard list only.

CREATE TABLE "design_drafts" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "design_drafts_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"current_step" integer DEFAULT 0 NOT NULL,
	"design_code" varchar(255),
	"pattern_name" varchar(255),
	"item_name" varchar(255),
	"state" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
