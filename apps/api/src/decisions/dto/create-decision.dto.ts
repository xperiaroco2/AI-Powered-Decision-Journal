import { IsNotEmpty, IsOptional, IsString, MinLength } from 'class-validator';

/**
 * Create Decision DTO
 *
 * Validates decision creation request.
 */
export class CreateDecisionDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(20, { message: 'Situation must be at least 20 characters' })
  situation: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(10, { message: 'Decision must be at least 10 characters' })
  chosenDecision: string;

  @IsString()
  @IsOptional()
  @MinLength(10, { message: 'Reasoning must be at least 10 characters' })
  personalReasoning?: string;
}
