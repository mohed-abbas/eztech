-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "sortPrice" DECIMAL(10,2) NOT NULL DEFAULT 0;

-- Backfill the coalesced sort price for existing rows
UPDATE "Product"
SET "sortPrice" = COALESCE("flatPrice", "dailyPrice", "hourlyPrice", "weeklyPrice", 0);

-- CreateIndex
CREATE INDEX "Product_isActive_sortPrice_idx" ON "Product"("isActive", "sortPrice");
