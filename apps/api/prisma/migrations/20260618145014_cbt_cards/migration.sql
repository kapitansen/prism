-- CreateTable
CREATE TABLE "cbt_cards" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "title_enc" TEXT NOT NULL,
    "explanation_enc" TEXT NOT NULL,
    "is_favorite" BOOLEAN NOT NULL DEFAULT false,
    "conviction" SMALLINT NOT NULL DEFAULT 100,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "cbt_cards_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "cbt_cards_user_id_is_favorite_idx" ON "cbt_cards"("user_id", "is_favorite");

-- AddForeignKey
ALTER TABLE "cbt_cards" ADD CONSTRAINT "cbt_cards_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
