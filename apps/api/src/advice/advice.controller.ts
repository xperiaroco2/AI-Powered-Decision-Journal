import {
  Controller,
  Get,
  Post,
  Body,
  Logger,
  UseGuards,
  HttpCode,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { AdvisoryService } from './services/advisory.service';
import { AdviceRequestDto } from './dto/advice-request.dto';
import {
  AdvisoryError,
  AdvisoryErrorCode,
  DEFAULT_ADVISORY_CONFIG,
} from './interfaces/advice.types';

@Controller('advice')
@UseGuards(JwtAuthGuard)
export class AdviceController {
  private readonly logger = new Logger(AdviceController.name);

  constructor(private advisoryService: AdvisoryService) {}

  /**
   * GET /advice
   * Get advisory system status for the current user
   */
  @Get()
  async getStatus(@CurrentUser() user: { id: string }) {
    try {
      return await this.advisoryService.getAdvisoryStatus(user.id);
    } catch (error) {
      this.logger.error('Error getting status', error);

      throw new HttpException(
        {
          error: 'Failed to get advisory status',
          details: error instanceof Error ? error.message : 'Unknown error',
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * POST /advice
   * Generate personalized advice based on user's past decisions or a specific attachment
   */
  @Post()
  @HttpCode(200)
  async generateAdvice(
    @CurrentUser() user: { id: string },
    @Body() dto: AdviceRequestDto,
  ) {
    const startTime = Date.now();

    try {
      const retrievalMode = dto.relatedAttachmentId
        ? 'attachment'
        : 'decisions';
      this.logger.log(
        `User ${user.id} asked: "${dto.question.substring(0, 100)}..." (mode: ${retrievalMode})`,
      );

      // Generate advice
      const response = await this.advisoryService.generateAdvice(
        user.id,
        {
          question: dto.question,
          relatedAttachmentId: dto.relatedAttachmentId,
        },
        DEFAULT_ADVISORY_CONFIG,
      );

      // Log success
      const totalTime = Date.now() - startTime;
      const retrievalCount =
        response.metadata.retrievalType === 'attachment'
          ? response.retrievedChunks?.length || 0
          : response.retrievedDecisions.length;

      this.logger.log(
        `Generated advice for user ${user.id} in ${totalTime}ms (retrieved ${retrievalCount} ${response.metadata.retrievalType})`,
      );

      return response;
    } catch (error) {
      // Handle AdvisoryError with specific error codes
      if (error instanceof AdvisoryError) {
        this.logger.error(`AdvisoryError (${error.code}): ${error.message}`);

        switch (error.code) {
          case AdvisoryErrorCode.INVALID_INPUT:
            throw new HttpException(
              { error: error.message },
              HttpStatus.BAD_REQUEST,
            );

          case AdvisoryErrorCode.UNAUTHORIZED:
            throw new HttpException(
              { error: error.message },
              HttpStatus.UNAUTHORIZED,
            );

          case AdvisoryErrorCode.RATE_LIMIT:
            throw new HttpException(
              {
                error: error.message,
                retryAfter: 60, // Suggest retry after 60 seconds
              },
              HttpStatus.TOO_MANY_REQUESTS,
            );

          case AdvisoryErrorCode.EMBEDDING_FAILED:
          case AdvisoryErrorCode.RETRIEVAL_FAILED:
            // These are recoverable - we can still provide advice without retrieval
            this.logger.warn(
              `Retrieval failed but continuing: ${error.message}`,
            );
            return {
              error:
                'Unable to retrieve past decisions, but I can still provide general advice.',
              advice:
                "I'm having trouble accessing your past decisions right now. Please try again in a moment, or rephrase your question.",
              retrievedDecisions: [],
              metadata: {
                retrievalCount: 0,
                hasContext: false,
                error: error.message,
              },
            };

          case AdvisoryErrorCode.LLM_FAILED:
          default:
            throw new HttpException(
              {
                error: 'Failed to generate advice. Please try again.',
                details: error.message,
              },
              HttpStatus.INTERNAL_SERVER_ERROR,
            );
        }
      }

      // Handle unexpected errors
      this.logger.error('Unexpected error', error);

      throw new HttpException(
        {
          error: 'An unexpected error occurred. Please try again.',
          details: error instanceof Error ? error.message : 'Unknown error',
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
