import { Module } from '@nestjs/common';
import {
  AttachmentsController,
  DecisionAttachmentsController,
} from './attachments.controller';
import { AttachmentsService } from './attachments.service';

/**
 * Attachments Module
 *
 * Provides attachment operations and file uploads.
 */
@Module({
  controllers: [AttachmentsController, DecisionAttachmentsController],
  providers: [AttachmentsService],
})
export class AttachmentsModule {}
