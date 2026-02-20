import {
  Controller,
  Get,
  Post,
  Param,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  Body,
  HttpCode,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { AttachmentsService } from './attachments.service';
import { CreateAttachmentDto } from './dto/create-attachment.dto';

/**
 * Attachments Controller
 *
 * Handles attachment operations and file uploads.
 * Migrated from:
 * - apps/web/app/api/attachments/route.ts
 * - apps/web/app/api/decisions/[id]/attachments/route.ts
 */
@Controller('attachments')
@UseGuards(JwtAuthGuard)
export class AttachmentsController {
  constructor(private readonly attachmentsService: AttachmentsService) {}

  @Get()
  async findAll(@CurrentUser() user: { id: string }) {
    return this.attachmentsService.findAll(user.id);
  }
}

/**
 * Decision Attachments Controller
 *
 * Nested routes for decision-specific attachments.
 */
@Controller('decisions/:decisionId/attachments')
@UseGuards(JwtAuthGuard)
export class DecisionAttachmentsController {
  constructor(private readonly attachmentsService: AttachmentsService) {}

  @Get()
  async findByDecision(
    @Param('decisionId') decisionId: string,
    @CurrentUser() user: { id: string },
  ) {
    return this.attachmentsService.findByDecision(decisionId, user.id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(FileInterceptor('file'))
  async create(
    @Param('decisionId') decisionId: string,
    @CurrentUser() user: { id: string },
    @Body() createAttachmentDto: CreateAttachmentDto,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException('File is required');
    }

    return this.attachmentsService.create(
      decisionId,
      user.id,
      createAttachmentDto.title,
      file,
    );
  }
}
