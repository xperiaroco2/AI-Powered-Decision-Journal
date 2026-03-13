import {
  Injectable,
  Logger,
  ConflictException,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { authAttemptsTotal } from '../observability/metrics';

/**
 * Auth Service
 *
 * Handles user authentication:
 * - Registration
 * - Login (with access + refresh tokens)
 * - Token refresh
 * - Logout
 */
@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async register(registerDto: RegisterDto) {
    const { email, password, name } = registerDto;

    // Check if user already exists
    const existingUser = await this.prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      authAttemptsTotal.add(1, { operation: 'register', outcome: 'failure' });
      throw new ConflictException('User with this email already exists');
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Create user
    try {
      const user = await this.prisma.user.create({
        data: {
          email,
          passwordHash,
          name: name || null,
        },
        select: {
          id: true,
          email: true,
          name: true,
          createdAt: true,
        },
      });

      authAttemptsTotal.add(1, { operation: 'register', outcome: 'success' });
      return {
        message: 'User created successfully',
        user,
      };
    } catch (error) {
      this.logger.error('Registration error', error);
      authAttemptsTotal.add(1, { operation: 'register', outcome: 'failure' });
      throw new InternalServerErrorException('Failed to create user');
    }
  }

  /**
   * Login user and return access + refresh tokens
   */
  async login(loginDto: LoginDto) {
    const { email, password } = loginDto;

    // Find user
    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!user || !user.passwordHash) {
      authAttemptsTotal.add(1, { operation: 'login', outcome: 'failure' });
      throw new UnauthorizedException('Invalid credentials');
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);

    if (!isPasswordValid) {
      authAttemptsTotal.add(1, { operation: 'login', outcome: 'failure' });
      throw new UnauthorizedException('Invalid credentials');
    }

    // Generate tokens
    const accessToken = this.generateAccessToken(user);
    const refreshToken = this.generateRefreshToken(user);

    authAttemptsTotal.add(1, { operation: 'login', outcome: 'success' });
    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
      },
    };
  }

  /**
   * Refresh access token using refresh token
   */
  async refresh(refreshToken: string) {
    try {
      // Verify refresh token
      const payload = this.jwtService.verify(refreshToken, {
        secret: process.env.JWT_REFRESH_SECRET,
      });

      // Find user
      const user = await this.prisma.user.findUnique({
        where: { id: payload.id },
      });

      if (!user) {
        throw new UnauthorizedException('Invalid refresh token');
      }

      // Generate new access token
      const accessToken = this.generateAccessToken(user);

      return { accessToken };
    } catch (_error) {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  /**
   * Generate access token (short-lived)
   */
  private generateAccessToken(user: {
    id: string;
    email: string;
    name: string | null;
  }) {
    const payload = {
      id: user.id,
      email: user.email,
      name: user.name,
    };

    return this.jwtService.sign(payload, {
      secret: process.env.JWT_SECRET,
      expiresIn: '15m', // 15 minutes
    });
  }

  /**
   * Generate refresh token (long-lived)
   */
  private generateRefreshToken(user: { id: string }) {
    const payload = {
      id: user.id,
    };

    return this.jwtService.sign(payload, {
      secret: process.env.JWT_REFRESH_SECRET,
      expiresIn: '7d', // 7 days
    });
  }
}
