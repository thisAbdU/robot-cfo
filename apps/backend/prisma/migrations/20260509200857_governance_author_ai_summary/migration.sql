-- AlterTable
ALTER TABLE "GovernanceProposal" ADD COLUMN     "aiSummary" TEXT,
ADD COLUMN     "author" TEXT NOT NULL DEFAULT '';
