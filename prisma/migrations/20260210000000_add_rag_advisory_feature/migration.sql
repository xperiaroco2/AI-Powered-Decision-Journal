-- Enable pgvector extension for vector similarity search
CREATE EXTENSION IF NOT EXISTS vector;

-- CreateEnum: Attachment lifecycle status
CREATE TYPE "AttachmentStatus" AS ENUM ('PENDING', 'PROCESSING', 'READY', 'FAILED');

-- CreateEnum: Embedding generation status
CREATE TYPE "EmbeddingStatus" AS ENUM ('PENDING', 'COMPLETED', 'FAILED');

-- CreateTable: Attachment (user-uploaded documents)
CREATE TABLE "Attachment" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "status" "AttachmentStatus" NOT NULL DEFAULT 'PENDING',
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Attachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable: AttachmentChunk (fixed-size chunks for embedding)
CREATE TABLE "AttachmentChunk" (
    "id" TEXT NOT NULL,
    "attachmentId" TEXT NOT NULL,
    "chunkIndex" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "startOffset" INTEGER NOT NULL,
    "endOffset" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AttachmentChunk_pkey" PRIMARY KEY ("id")
);

-- CreateTable: DecisionEmbedding (vector embeddings for Decisions)
CREATE TABLE "DecisionEmbedding" (
    "id" TEXT NOT NULL,
    "decisionId" TEXT NOT NULL,
    "embedding" vector(1536) NOT NULL,
    "status" "EmbeddingStatus" NOT NULL DEFAULT 'PENDING',
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DecisionEmbedding_pkey" PRIMARY KEY ("id")
);

-- CreateTable: AttachmentChunkEmbedding (vector embeddings for chunks)
CREATE TABLE "AttachmentChunkEmbedding" (
    "id" TEXT NOT NULL,
    "chunkId" TEXT NOT NULL,
    "embedding" vector(1536) NOT NULL,
    "status" "EmbeddingStatus" NOT NULL DEFAULT 'PENDING',
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AttachmentChunkEmbedding_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: Unique constraint on DecisionEmbedding.decisionId
CREATE UNIQUE INDEX "DecisionEmbedding_decisionId_key" ON "DecisionEmbedding"("decisionId");

-- CreateIndex: Unique constraint on AttachmentChunkEmbedding.chunkId
CREATE UNIQUE INDEX "AttachmentChunkEmbedding_chunkId_key" ON "AttachmentChunkEmbedding"("chunkId");

-- CreateIndex: Unique constraint on AttachmentChunk (attachmentId, chunkIndex)
CREATE UNIQUE INDEX "AttachmentChunk_attachmentId_chunkIndex_key" ON "AttachmentChunk"("attachmentId", "chunkIndex");

-- CreateIndex: Query optimization indexes
CREATE INDEX "Attachment_userId_idx" ON "Attachment"("userId");
CREATE INDEX "Attachment_status_idx" ON "Attachment"("status");
CREATE INDEX "Attachment_createdAt_idx" ON "Attachment"("createdAt");
CREATE INDEX "AttachmentChunk_attachmentId_idx" ON "AttachmentChunk"("attachmentId");
CREATE INDEX "DecisionEmbedding_status_idx" ON "DecisionEmbedding"("status");
CREATE INDEX "AttachmentChunkEmbedding_status_idx" ON "AttachmentChunkEmbedding"("status");

-- CreateIndex: Vector similarity search indexes (IVFFlat for approximate nearest neighbor)
-- Using cosine distance (default for OpenAI embeddings)
-- lists=100 is a reasonable default for small-to-medium datasets (< 1M vectors)
CREATE INDEX "DecisionEmbedding_embedding_idx" ON "DecisionEmbedding" 
USING ivfflat ("embedding" vector_cosine_ops) WITH (lists = 100);

CREATE INDEX "AttachmentChunkEmbedding_embedding_idx" ON "AttachmentChunkEmbedding" 
USING ivfflat ("embedding" vector_cosine_ops) WITH (lists = 100);

-- AddForeignKey: Attachment → User (cascade delete)
ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_userId_fkey" 
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: AttachmentChunk → Attachment (cascade delete)
ALTER TABLE "AttachmentChunk" ADD CONSTRAINT "AttachmentChunk_attachmentId_fkey" 
FOREIGN KEY ("attachmentId") REFERENCES "Attachment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: DecisionEmbedding → Decision (cascade delete)
ALTER TABLE "DecisionEmbedding" ADD CONSTRAINT "DecisionEmbedding_decisionId_fkey" 
FOREIGN KEY ("decisionId") REFERENCES "Decision"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: AttachmentChunkEmbedding → AttachmentChunk (cascade delete)
ALTER TABLE "AttachmentChunkEmbedding" ADD CONSTRAINT "AttachmentChunkEmbedding_chunkId_fkey" 
FOREIGN KEY ("chunkId") REFERENCES "AttachmentChunk"("id") ON DELETE CASCADE ON UPDATE CASCADE;

