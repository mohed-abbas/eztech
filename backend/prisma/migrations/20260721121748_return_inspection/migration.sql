-- CreateEnum
CREATE TYPE "ReturnInspection" AS ENUM ('available', 'damaged');

-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'return_processed';

-- AlterTable
ALTER TABLE "Return" ADD COLUMN     "inspectedAt" TIMESTAMP(3),
ADD COLUMN     "inspectionNote" TEXT,
ADD COLUMN     "inspectionResult" "ReturnInspection";
