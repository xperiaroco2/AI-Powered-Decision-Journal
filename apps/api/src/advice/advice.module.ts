import { Module } from '@nestjs/common';
import { AdviceController } from './advice.controller';
import { AdvisoryService } from './services/advisory.service';
import { VectorRetrievalService } from './services/vector-retrieval.service';

@Module({
  controllers: [AdviceController],
  providers: [AdvisoryService, VectorRetrievalService],
})
export class AdviceModule {}
