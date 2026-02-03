-- CreateEnum
CREATE TYPE "DecisionStatus" AS ENUM ('PENDING', 'PROCESSING', 'DONE', 'FAILED');

-- CreateEnum
CREATE TYPE "Category" AS ENUM ('CAREER', 'FINANCIAL', 'RELATIONSHIPS', 'HEALTH', 'EDUCATION', 'BUSINESS', 'LIFESTYLE', 'ETHICAL', 'CREATIVE', 'TECHNICAL', 'OTHER');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT,
    "name" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Decision" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "situation" TEXT NOT NULL,
    "chosenDecision" TEXT NOT NULL,
    "personalReasoning" TEXT,
    "status" "DecisionStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Decision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DecisionAnalysis" (
    "id" TEXT NOT NULL,
    "decisionId" TEXT NOT NULL,
    "category" "Category" NOT NULL,
    "cognitiveBiases" JSONB NOT NULL,
    "missedAlternatives" JSONB NOT NULL,
    "insights" JSONB NOT NULL,
    "rawAiResponse" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DecisionAnalysis_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_email_idx" ON "User"("email");

-- CreateIndex
CREATE INDEX "Decision_userId_idx" ON "Decision"("userId");

-- CreateIndex
CREATE INDEX "Decision_status_idx" ON "Decision"("status");

-- CreateIndex
CREATE INDEX "Decision_createdAt_idx" ON "Decision"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "DecisionAnalysis_decisionId_key" ON "DecisionAnalysis"("decisionId");

-- CreateIndex
CREATE INDEX "DecisionAnalysis_decisionId_idx" ON "DecisionAnalysis"("decisionId");

-- CreateIndex
CREATE INDEX "DecisionAnalysis_category_idx" ON "DecisionAnalysis"("category");

-- AddForeignKey
ALTER TABLE "Decision" ADD CONSTRAINT "Decision_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DecisionAnalysis" ADD CONSTRAINT "DecisionAnalysis_decisionId_fkey" FOREIGN KEY ("decisionId") REFERENCES "Decision"("id") ON DELETE CASCADE ON UPDATE CASCADE;
