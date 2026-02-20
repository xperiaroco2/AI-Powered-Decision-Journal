import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { DecisionsService } from './decisions.service';
import { CreateDecisionDto } from './dto/create-decision.dto';

/**
 * Decisions Controller
 *
 * Handles decision CRUD operations and analysis reruns.
 * Migrated from:
 * - apps/web/app/api/decisions/route.ts
 * - apps/web/app/api/decisions/[id]/route.ts
 * - apps/web/app/api/decisions/[id]/rerun/route.ts
 */
@Controller('decisions')
@UseGuards(JwtAuthGuard)
export class DecisionsController {
  constructor(private readonly decisionsService: DecisionsService) {}

  @Get()
  async findAll(@CurrentUser() user: { id: string }) {
    return this.decisionsService.findAll(user.id);
  }

  @Get(':id')
  async findOne(@Param('id') id: string, @CurrentUser() user: { id: string }) {
    return this.decisionsService.findOne(id, user.id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body() createDecisionDto: CreateDecisionDto,
    @CurrentUser() user: { id: string },
  ) {
    return this.decisionsService.create(user.id, createDecisionDto);
  }

  @Post(':id/rerun')
  @HttpCode(HttpStatus.OK)
  async rerun(@Param('id') id: string, @CurrentUser() user: { id: string }) {
    return this.decisionsService.rerun(id, user.id);
  }
}
