-- DropForeignKey
ALTER TABLE "ChurnScore" DROP CONSTRAINT "ChurnScore_company_id_fkey";

-- DropForeignKey
ALTER TABLE "ChurnScore" DROP CONSTRAINT "ChurnScore_customer_id_fkey";

-- AddForeignKey
ALTER TABLE "ChurnScore" ADD CONSTRAINT "ChurnScore_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChurnScore" ADD CONSTRAINT "ChurnScore_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
