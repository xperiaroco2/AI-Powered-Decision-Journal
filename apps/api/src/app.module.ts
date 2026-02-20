import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { QueueModule } from './queue/queue.module';
import { AuthModule } from './auth/auth.module';
import { HealthController } from './health/health.controller';
import { DashboardModule } from './dashboard/dashboard.module';
import { DecisionsModule } from './decisions/decisions.module';
import { AttachmentsModule } from './attachments/attachments.module';
import { AdviceModule } from './advice/advice.module';

@Module({
  imports: [
    PrismaModule, // Global: Database access
    QueueModule, // Global: BullMQ client
    AuthModule, // JWT validation + registration
    DashboardModule, // Dashboard statistics
    DecisionsModule, // Decisions CRUD + rerun
    AttachmentsModule, // Attachments + file upload
    AdviceModule, // Advisory (RAG)
  ],
  controllers: [HealthController], // Health check
})
export class AppModule {}
