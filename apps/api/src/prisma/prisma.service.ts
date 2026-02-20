import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

/**
 * Prisma Service
 *
 * Wraps PrismaClient and manages database connection lifecycle.
 * Automatically connects on module init and disconnects on module destroy.
 */
@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  async onModuleInit() {
    await this.$connect();
    console.log('✓ Prisma connected to database');
  }

  async onModuleDestroy() {
    await this.$disconnect();
    console.log('✓ Prisma disconnected from database');
  }
}
