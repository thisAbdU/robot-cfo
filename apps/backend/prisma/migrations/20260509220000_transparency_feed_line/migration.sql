-- CreateTable
CREATE TABLE "TransparencyFeedLine" (
    "id" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'automation',
    "message" TEXT NOT NULL,
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TransparencyFeedLine_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TransparencyFeedLine_createdAt_idx" ON "TransparencyFeedLine"("createdAt");
