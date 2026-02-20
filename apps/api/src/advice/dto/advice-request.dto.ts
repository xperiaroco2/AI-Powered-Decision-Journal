import { IsString, IsOptional, MinLength, MaxLength } from 'class-validator';

export class AdviceRequestDto {
  @IsString()
  @MinLength(10, { message: 'Question must be at least 10 characters' })
  @MaxLength(2000, { message: 'Question must be at most 2000 characters' })
  question: string;

  @IsString()
  @IsOptional()
  relatedAttachmentId?: string;
}
