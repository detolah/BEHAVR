-- CreateTable
CREATE TABLE "ChurnScore" (
    "id" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "score" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "factors" JSONB,
    "scored_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChurnScore_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ChurnScore_company_id_score_idx" ON "ChurnScore"("company_id", "score");

-- CreateIndex
CREATE UNIQUE INDEX "ChurnScore_customer_id_company_id_key" ON "ChurnScore"("customer_id", "company_id");

-- AddForeignKey
ALTER TABLE "ChurnScore" ADD CONSTRAINT "ChurnScore_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChurnScore" ADD CONSTRAINT "ChurnScore_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
