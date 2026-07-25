-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "preparedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Order_warehouseId_idx" ON "Order"("warehouseId");
