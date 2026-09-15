CREATE TYPE "public"."grade_band" AS ENUM('k-1', '2-3', '4-5');--> statement-breakpoint
CREATE TYPE "public"."interest_theme" AS ENUM('space', 'ocean', 'jungle');--> statement-breakpoint
CREATE TABLE "band_progress" (
	"learner_id" uuid NOT NULL,
	"grade_band" "grade_band" NOT NULL,
	"total_solves" integer DEFAULT 0 NOT NULL,
	"checkpoints_passed" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "band_progress_learner_id_grade_band_pk" PRIMARY KEY("learner_id","grade_band"),
	CONSTRAINT "band_total_solves_not_negative" CHECK ("band_progress"."total_solves" >= 0),
	CONSTRAINT "band_checkpoints_not_negative" CHECK ("band_progress"."checkpoints_passed" >= 0)
);
--> statement-breakpoint
CREATE TABLE "camp_mastery" (
	"learner_id" uuid NOT NULL,
	"grade_band" "grade_band" NOT NULL,
	"camp_number" smallint NOT NULL,
	"mastery" smallint DEFAULT 0 NOT NULL,
	"touched_at_solve" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "camp_mastery_learner_id_grade_band_camp_number_pk" PRIMARY KEY("learner_id","grade_band","camp_number"),
	CONSTRAINT "camp_number_is_one_of_four" CHECK ("camp_mastery"."camp_number" between 1 and 4),
	CONSTRAINT "mastery_within_meter" CHECK ("camp_mastery"."mastery" between 0 and 100),
	CONSTRAINT "touched_at_solve_not_negative" CHECK ("camp_mastery"."touched_at_solve" >= 0)
);
--> statement-breakpoint
CREATE TABLE "climb_days" (
	"learner_id" uuid NOT NULL,
	"grade_band" "grade_band" NOT NULL,
	"local_date" date NOT NULL,
	"camp_number" smallint NOT NULL,
	"solves" integer DEFAULT 0 NOT NULL,
	"clean_solves" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "climb_days_learner_id_grade_band_local_date_camp_number_pk" PRIMARY KEY("learner_id","grade_band","local_date","camp_number"),
	CONSTRAINT "climb_camp_is_one_of_four" CHECK ("climb_days"."camp_number" between 1 and 4),
	CONSTRAINT "climb_solves_not_negative" CHECK ("climb_days"."solves" >= 0),
	CONSTRAINT "climb_clean_within_solves" CHECK ("climb_days"."clean_solves" >= 0 and "climb_days"."clean_solves" <= "climb_days"."solves")
);
--> statement-breakpoint
CREATE TABLE "learners" (
	"id" uuid PRIMARY KEY NOT NULL,
	"grade_band" "grade_band" NOT NULL,
	"interest_theme" "interest_theme" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "band_progress" ADD CONSTRAINT "band_progress_learner_id_learners_id_fk" FOREIGN KEY ("learner_id") REFERENCES "public"."learners"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "camp_mastery" ADD CONSTRAINT "camp_mastery_learner_id_learners_id_fk" FOREIGN KEY ("learner_id") REFERENCES "public"."learners"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "climb_days" ADD CONSTRAINT "climb_days_learner_id_learners_id_fk" FOREIGN KEY ("learner_id") REFERENCES "public"."learners"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "camp_mastery_learner_idx" ON "camp_mastery" USING btree ("learner_id","grade_band");--> statement-breakpoint
CREATE INDEX "climb_days_learner_idx" ON "climb_days" USING btree ("learner_id");