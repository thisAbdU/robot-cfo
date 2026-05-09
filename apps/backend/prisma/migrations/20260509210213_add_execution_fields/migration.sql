-- CreateEnum
CREATE TYPE "DecisionExecutionStatus" AS ENUM ('PENDING', 'SIGNING', 'BRIDGING', 'COMPLETED', 'FAILED');

-- AlterTable
ALTER TABLE "AIDecision" ADD COLUMN     "executionStatus" "DecisionExecutionStatus",
ADD COLUMN     "lifiRouteId" TEXT,
ADD COLUMN     "safeTxHash" TEXT;

-- CreateIndex
CREATE INDEX "AIDecision_executionStatus_idx" ON "AIDecision"("executionStatus");

-- CreateIndex
CREATE INDEX "AIDecision_lifiRouteId_idx" ON "AIDecision"("lifiRouteId");
