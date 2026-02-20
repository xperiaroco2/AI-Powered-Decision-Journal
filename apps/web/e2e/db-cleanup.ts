/**
 * Database Cleanup Utility for E2E Tests
 * 
 * This script is run from global setup/teardown and uses the API app's Prisma client
 * to clean up the test database. It's kept separate from the web app to avoid
 * bundling Prisma client in the Next.js application.
 */

import { PrismaClient } from '../../../node_modules/@prisma/client';

/**
 * Clean up all data from the test database
 */
export async function cleanupE2EDatabase(databaseUrl: string): Promise<void> {
  const prisma = new PrismaClient({
    datasources: {
      db: {
        url: databaseUrl,
      },
    },
  });

  try {
    // Delete in order to respect foreign key constraints
    await prisma.attachmentChunkEmbedding.deleteMany();
    await prisma.attachmentChunk.deleteMany();
    await prisma.attachment.deleteMany();
    await prisma.decisionEmbedding.deleteMany();
    await prisma.decisionAnalysisRun.deleteMany();
    await prisma.decision.deleteMany();
    await prisma.user.deleteMany();
  } finally {
    await prisma.$disconnect();
  }
}

// If run directly from command line
if (require.main === module) {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('DATABASE_URL environment variable is required');
    process.exit(1);
  }

  cleanupE2EDatabase(databaseUrl)
    .then(() => {
      console.log('✓ Database cleaned up successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('✗ Failed to clean up database:', error);
      process.exit(1);
    });
}

