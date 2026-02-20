import { Module } from '@nestjs/common';
import { DecisionsController } from './decisions.controller';
import { DecisionsService } from './decisions.service';

/**
 * Decisions Module
 *
 * Provides decision CRUD operations and analysis reruns.
 */
@Module({
  controllers: [DecisionsController],
  providers: [DecisionsService],
})
export class DecisionsModule {}
