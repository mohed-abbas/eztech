-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('awaiting_payment', 'paid', 'refunded', 'failed');

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "deliveryFee" DECIMAL(10,2),
ADD COLUMN     "paymentStatus" "PaymentStatus",
ADD COLUMN     "stripePaymentIntentId" TEXT,
ADD COLUMN     "subtotal" DECIMAL(10,2),
ADD COLUMN     "total" DECIMAL(10,2),
ADD COLUMN     "warehouseId" TEXT;

-- Backfill legacy rider-origin orders so they stay rider-visible (A1). Existing rows
-- predate the commerce flow; mark them paid rather than defaulting to awaiting_payment
-- (which would hide them from the rider pool).
UPDATE "Order" SET "paymentStatus" = 'paid' WHERE "paymentStatus" IS NULL;

-- CreateTable
CREATE TABLE "OrderItem" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "productId" TEXT,
    "name" TEXT NOT NULL,
    "imageUrl" TEXT NOT NULL DEFAULT '',
    "quantity" INTEGER NOT NULL,
    "durationUnit" TEXT NOT NULL,
    "durationValue" INTEGER NOT NULL,
    "unitPrice" DECIMAL(10,2) NOT NULL,
    "lineTotal" DECIMAL(10,2) NOT NULL,

    CONSTRAINT "OrderItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Zone" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "geometry" JSONB NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Zone_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OrderItem_orderId_idx" ON "OrderItem"("orderId");

-- CreateIndex
CREATE INDEX "Zone_isActive_idx" ON "Zone"("isActive");

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;
