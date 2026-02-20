import { Global, Module } from '@nestjs/common';
import { QueueService } from './queue.service';

/**
 * Queue Module (Global)
 *
 * Provides BullMQ queue access throughout the application.
 * Marked as @Global() so it doesn't need to be imported in every module.
 */
@Global()
@Module({
  providers: [QueueService],
  exports: [QueueService],
})
export class QueueModule {}
