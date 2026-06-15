-- CreateEnum
CREATE TYPE "entry_type" AS ENUM ('daily', 'report', 'note');

-- CreateEnum
CREATE TYPE "entry_origin" AS ENUM ('web', 'telegram', 'mcp_session', 'import');

-- CreateEnum
CREATE TYPE "ingest_status" AS ENUM ('draft', 'pending', 'parsed', 'awaiting_answers', 'confirmed', 'failed');

-- CreateEnum
CREATE TYPE "entity_type" AS ENUM ('person', 'project', 'habit', 'event');

-- CreateEnum
CREATE TYPE "entity_status" AS ENUM ('active', 'archived');

-- CreateEnum
CREATE TYPE "metric_source" AS ENUM ('manual', 'extracted');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "totp_secret_enc" TEXT,
    "is_demo" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_settings" (
    "user_id" UUID NOT NULL,
    "ui_language" TEXT NOT NULL DEFAULT 'ru',
    "theme" TEXT NOT NULL DEFAULT 'system',
    "theme_preset" TEXT,
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "user_settings_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "entries" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "type" "entry_type" NOT NULL,
    "origin" "entry_origin" NOT NULL,
    "title_enc" TEXT,
    "body_enc" TEXT NOT NULL,
    "summary_enc" TEXT,
    "occurred_on" DATE NOT NULL,
    "occurred_to" DATE,
    "ingest_status" "ingest_status" NOT NULL DEFAULT 'draft',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "entities" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "type" "entity_type" NOT NULL,
    "name_enc" TEXT NOT NULL,
    "aliases_enc" TEXT,
    "description_enc" TEXT,
    "status" "entity_status" NOT NULL DEFAULT 'active',
    "period_start" DATE,
    "period_end" DATE,
    "digest_enc" TEXT,
    "digest_updated_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "entities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "metric_definitions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "unit" TEXT,
    "scale_min" SMALLINT,
    "scale_max" SMALLINT,
    "source" "metric_source" NOT NULL,

    CONSTRAINT "metric_definitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "metric_values" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "metric_key" TEXT NOT NULL,
    "value" DECIMAL NOT NULL,
    "occurred_on" DATE NOT NULL,
    "occurred_at" TIMESTAMPTZ,
    "source" "metric_source" NOT NULL,
    "entry_id" UUID,

    CONSTRAINT "metric_values_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_EntityToEntry" (
    "A" UUID NOT NULL,
    "B" UUID NOT NULL,

    CONSTRAINT "_EntityToEntry_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "entries_user_id_occurred_on_idx" ON "entries"("user_id", "occurred_on");

-- CreateIndex
CREATE INDEX "entities_user_id_type_idx" ON "entities"("user_id", "type");

-- CreateIndex
CREATE UNIQUE INDEX "metric_definitions_user_id_key_key" ON "metric_definitions"("user_id", "key");

-- CreateIndex
CREATE UNIQUE INDEX "metric_values_user_id_metric_key_occurred_on_source_key" ON "metric_values"("user_id", "metric_key", "occurred_on", "source");

-- CreateIndex
CREATE INDEX "_EntityToEntry_B_index" ON "_EntityToEntry"("B");

-- AddForeignKey
ALTER TABLE "user_settings" ADD CONSTRAINT "user_settings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entries" ADD CONSTRAINT "entries_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entities" ADD CONSTRAINT "entities_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "metric_definitions" ADD CONSTRAINT "metric_definitions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "metric_values" ADD CONSTRAINT "metric_values_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "metric_values" ADD CONSTRAINT "metric_values_entry_id_fkey" FOREIGN KEY ("entry_id") REFERENCES "entries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_EntityToEntry" ADD CONSTRAINT "_EntityToEntry_A_fkey" FOREIGN KEY ("A") REFERENCES "entities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_EntityToEntry" ADD CONSTRAINT "_EntityToEntry_B_fkey" FOREIGN KEY ("B") REFERENCES "entries"("id") ON DELETE CASCADE ON UPDATE CASCADE;
