-- AlterTable
ALTER TABLE "Attachment" ADD COLUMN "decisionId" TEXT NOT NULL;

-- CreateIndex
CREATE INDEX "Attachment_decisionId_idx" ON "Attachment"("decisionId");

-- AddForeignKey
ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_decisionId_fkey" FOREIGN KEY ("decisionId") REFERENCES "Decision"("id") ON DELETE CASCADE ON UPDATE CASCADE;

