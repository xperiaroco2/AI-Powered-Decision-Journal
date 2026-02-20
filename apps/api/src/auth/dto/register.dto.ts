import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';

/**
 * Register DTO
 *
 * Validates user registration request.
 */
export class RegisterDto {
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(6, { message: 'Password must be at least 6 characters' })
  password: string;

  @IsString()
  @IsOptional()
  name?: string;
}
