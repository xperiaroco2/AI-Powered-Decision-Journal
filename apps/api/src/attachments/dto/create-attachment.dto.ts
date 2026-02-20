import { IsNotEmpty, IsString, MinLength, MaxLength } from 'class-validator';

/**
 * Create Attachment DTO
 *
 * Validates attachment creation request.
 * Note: File validation is done separately in the controller.
 */
export class CreateAttachmentDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(3, { message: 'Title must be at least 3 characters' })
  @MaxLength(200, { message: 'Title must be at most 200 characters' })
  title: string;
}
