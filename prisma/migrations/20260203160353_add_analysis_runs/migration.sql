-- CreateEnum
CREATE TYPE "AnalysisRunStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');

-- AlterTable
ALTER TABLE "Decision" ADD COLUMN     "latestRunId" TEXT;

-- CreateTable
CREATE TABLE "DecisionAnalysisRun" (
    "id" TEXT NOT NULL,
    "decisionId" TEXT NOT NULL,
    "status" "AnalysisRunStatus" NOT NULL DEFAULT 'PENDING',
    "provider" TEXT NOT NULL,
    "resultJson" JSONB,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "DecisionAnalysisRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DecisionAnalysisRun_decisionId_idx" ON "DecisionAnalysisRun"("decisionId");

-- CreateIndex
CREATE INDEX "DecisionAnalysisRun_status_idx" ON "DecisionAnalysisRun"("status");

-- CreateIndex
CREATE INDEX "DecisionAnalysisRun_createdAt_idx" ON "DecisionAnalysisRun"("createdAt");

-- CreateIndex
CREATE INDEX "Decision_latestRunId_idx" ON "Decision"("latestRunId");

-- AddForeignKey
ALTER TABLE "Decision" ADD CONSTRAINT "Decision_latestRunId_fkey" FOREIGN KEY ("latestRunId") REFERENCES "DecisionAnalysisRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DecisionAnalysisRun" ADD CONSTRAINT "DecisionAnalysisRun_decisionId_fkey" FOREIGN KEY ("decisionId") REFERENCES "Decision"("id") ON DELETE CASCADE ON UPDATE CASCADE;
