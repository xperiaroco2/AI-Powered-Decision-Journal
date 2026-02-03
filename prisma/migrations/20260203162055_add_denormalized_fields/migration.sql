-- AlterTable
ALTER TABLE "DecisionAnalysisRun" ADD COLUMN     "biasesText" TEXT[],
ADD COLUMN     "categoryText" TEXT;

-- CreateIndex
CREATE INDEX "DecisionAnalysisRun_categoryText_idx" ON "DecisionAnalysisRun"("categoryText");
