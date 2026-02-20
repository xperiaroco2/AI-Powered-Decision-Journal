import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

/**
 * Prisma Module (Global)
 *
 * Provides database access throughout the application.
 * Marked as @Global() so it doesn't need to be imported in every module.
 */
@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
