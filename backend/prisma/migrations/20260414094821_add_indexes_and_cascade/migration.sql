-- DropForeignKey
ALTER TABLE "ProfileHistory" DROP CONSTRAINT "ProfileHistory_profile_id_fkey";

-- CreateIndex
CREATE INDEX "Customer_company_id_external_id_idx" ON "Customer"("company_id", "external_id");

-- CreateIndex
CREATE INDEX "Profile_company_id_idx" ON "Profile"("company_id");

-- CreateIndex
CREATE INDEX "ProfileHistory_profile_id_idx" ON "ProfileHistory"("profile_id");

-- CreateIndex
CREATE INDEX "Signal_company_id_idx" ON "Signal"("company_id");

-- AddForeignKey
ALTER TABLE "ProfileHistory" ADD CONSTRAINT "ProfileHistory_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
