CREATE TYPE "public"."chat_role" AS ENUM('system', 'user', 'assistant');--> statement-breakpoint
CREATE TABLE "account" (
	"id" uuid PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"display_name" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "account_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "chat" (
	"id" uuid PRIMARY KEY NOT NULL,
	"account_id" uuid NOT NULL,
	"drawing_id" uuid,
	"slug" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chat_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "chat_message" (
	"id" uuid PRIMARY KEY NOT NULL,
	"chat_id" uuid NOT NULL,
	"role" "chat_role" NOT NULL,
	"content" jsonb NOT NULL,
	"sequence" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chat_message_chat_id_sequence_unq" UNIQUE("chat_id","sequence")
);
--> statement-breakpoint
CREATE TABLE "drawing" (
	"id" uuid PRIMARY KEY NOT NULL,
	"account_id" uuid NOT NULL,
	"slug" text,
	"title" text,
	"canvas_state_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"snapshot_data_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "chat" ADD CONSTRAINT "chat_account_id_account_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."account"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat" ADD CONSTRAINT "chat_drawing_id_drawing_id_fk" FOREIGN KEY ("drawing_id") REFERENCES "public"."drawing"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_message" ADD CONSTRAINT "chat_message_chat_id_chat_id_fk" FOREIGN KEY ("chat_id") REFERENCES "public"."chat"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drawing" ADD CONSTRAINT "drawing_account_id_account_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."account"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "chat_account_id_idx" ON "chat" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "chat_drawing_id_idx" ON "chat" USING btree ("drawing_id");--> statement-breakpoint
CREATE INDEX "chat_message_chat_id_idx" ON "chat_message" USING btree ("chat_id");--> statement-breakpoint
CREATE INDEX "drawing_account_id_idx" ON "drawing" USING btree ("account_id");