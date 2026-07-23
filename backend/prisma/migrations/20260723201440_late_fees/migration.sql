-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationType" ADD VALUE 'late_fee_pending';
ALTER TYPE "NotificationType" ADD VALUE 'late_fee_charged';

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "lateFeeAmount" DECIMAL(10,2),
ADD COLUMN     "lateFeeChargedAt" TIMESTAMP(3),
ADD COLUMN     "lateFeeStripePaymentIntentId" TEXT,
ADD COLUMN     "stripePaymentMethodId" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "stripeCustomerId" TEXT;
