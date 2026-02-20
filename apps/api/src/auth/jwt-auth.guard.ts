import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * JWT Auth Guard
 *
 * Protects routes by requiring a valid JWT token.
 * Use with @UseGuards(JwtAuthGuard) decorator on controllers or routes.
 *
 * Example:
 * @Controller('decisions')
 * @UseGuards(JwtAuthGuard)
 * export class DecisionsController { ... }
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}
