-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationType" ADD VALUE 'order_confirmed';
ALTER TYPE "NotificationType" ADD VALUE 'rider_assigned';
ALTER TYPE "NotificationType" ADD VALUE 'order_picked_up';
ALTER TYPE "NotificationType" ADD VALUE 'order_delivered';
ALTER TYPE "NotificationType" ADD VALUE 'return_reminder';
ALTER TYPE "NotificationType" ADD VALUE 'low_stock';

-- AlterTable
-- event/channel added WITH NOT NULL DEFAULT — Postgres backfills every existing row in the same
-- statement (fast-default, no table rewrite). This MUST land before the (orderId,event,channel)
-- unique index below, or the index build fails against rows lacking the columns (Pitfall 3).
ALTER TABLE "Notification" ADD COLUMN     "channel" TEXT NOT NULL DEFAULT 'in_app',
ADD COLUMN     "event" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "orderId" TEXT,
ADD COLUMN     "readAt" TIMESTAMP(3),
ADD COLUMN     "scheduledAt" TIMESTAMP(3),
ADD COLUMN     "sentAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "rentalEndsAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "emailOptOut" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "PasswordResetToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PasswordResetToken_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PasswordResetToken_tokenHash_key" ON "PasswordResetToken"("tokenHash");

-- CreateIndex
CREATE INDEX "Notification_event_sentAt_idx" ON "Notification"("event", "sentAt");

-- CreateIndex
-- built AFTER event/channel are backfilled above (Pitfall 3) — existing rows carry
-- orderId=NULL (new column), and Postgres treats NULL as distinct per row in a unique index,
-- so pre-existing Notification rows never collide regardless of their (event,channel) values.
CREATE UNIQUE INDEX "Notification_orderId_event_channel_key" ON "Notification"("orderId", "event", "channel");

-- AddForeignKey
ALTER TABLE "PasswordResetToken" ADD CONSTRAINT "PasswordResetToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
