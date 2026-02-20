import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

/**
 * JWT Strategy
 *
 * Validates JWT access tokens.
 * Uses JWT_SECRET to verify tokens.
 *
 * JWT payload structure:
 * {
 *   id: string,      // User ID
 *   email: string,
 *   name?: string,
 *   iat: number,
 *   exp: number
 * }
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET,
    });

    if (!process.env.JWT_SECRET) {
      throw new Error('JWT_SECRET environment variable is not set');
    }
  }

  /**
   * Validate JWT payload
   *
   * This method is called after the JWT is verified.
   * The return value is attached to the request as `request.user`.
   */
  async validate(payload: { id: string; email: string; name?: string }) {
    return {
      id: payload.id,
      email: payload.email,
      name: payload.name,
    };
  }
}
