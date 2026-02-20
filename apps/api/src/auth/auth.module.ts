import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { JwtStrategy } from './jwt.strategy';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

/**
 * Auth Module
 *
 * Provides:
 * - JWT authentication using custom JWT tokens
 * - User registration and login endpoints
 */
@Module({
  imports: [
    PassportModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET,
      signOptions: { expiresIn: '15m' }, // Access token expiration
    }),
  ],
  controllers: [AuthController],
  providers: [JwtStrategy, AuthService],
  exports: [JwtModule, PassportModule],
})
export class AuthModule {}
