-- CreateEnum
CREATE TYPE "AIDecisionType" AS ENUM ('REBALANCE', 'YIELD', 'GOVERNANCE');

-- CreateEnum
CREATE TYPE "AIDecisionStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "AIDecision" (
    "id" TEXT NOT NULL,
    "treasuryId" TEXT NOT NULL,
    "type" "AIDecisionType" NOT NULL,
    "reasoning" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "status" "AIDecisionStatus" NOT NULL DEFAULT 'PENDING',
    "txHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AIDecision_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AIDecision_treasuryId_idx" ON "AIDecision"("treasuryId");

-- CreateIndex
CREATE INDEX "AIDecision_status_idx" ON "AIDecision"("status");

-- AddForeignKey
ALTER TABLE "AIDecision" ADD CONSTRAINT "AIDecision_treasuryId_fkey" FOREIGN KEY ("treasuryId") REFERENCES "Treasury"("id") ON DELETE CASCADE ON UPDATE CASCADE;
