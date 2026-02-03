/*
  Warnings:

  - You are about to drop the `DecisionAnalysis` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "DecisionAnalysis" DROP CONSTRAINT "DecisionAnalysis_decisionId_fkey";

-- DropTable
DROP TABLE "DecisionAnalysis";
