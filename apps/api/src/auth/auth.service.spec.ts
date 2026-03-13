import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

// Mock bcrypt module
jest.mock('bcryptjs', () => ({
  hash: jest.fn(),
  compare: jest.fn(),
}));

// Import bcrypt to access the mocked functions
const bcrypt = require('bcryptjs');

describe('AuthService', () => {
  let service: AuthService;
  let prismaService: PrismaService;
  let jwtService: JwtService;

  const mockPrismaService = {
    user: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
  };

  const mockJwtService = {
    sign: jest.fn(),
    verify: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: JwtService,
          useValue: mockJwtService,
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    prismaService = module.get<PrismaService>(PrismaService);
    jwtService = module.get<JwtService>(JwtService);

    // Clear all mocks before each test
    jest.clearAllMocks();
    // Restore all spies to avoid "Cannot redefine property" errors
    jest.restoreAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('register', () => {
    const registerDto: RegisterDto = {
      email: 'test@example.com',
      password: 'password123',
      name: 'Test User',
    };

    it('should successfully register a new user', async () => {
      const hashedPassword = 'hashed_password';
      const createdUser = {
        id: 'user-id-123',
        email: registerDto.email,
        name: registerDto.name,
        createdAt: new Date(),
      };

      mockPrismaService.user.findUnique.mockResolvedValue(null);
      mockPrismaService.user.create.mockResolvedValue(createdUser);
      bcrypt.hash.mockResolvedValue(hashedPassword);

      const result = await service.register(registerDto);

      expect(mockPrismaService.user.findUnique).toHaveBeenCalledWith({
        where: { email: registerDto.email },
      });
      expect(bcrypt.hash).toHaveBeenCalledWith(registerDto.password, 10);
      expect(mockPrismaService.user.create).toHaveBeenCalledWith({
        data: {
          email: registerDto.email,
          passwordHash: hashedPassword,
          name: registerDto.name,
        },
        select: {
          id: true,
          email: true,
          name: true,
          createdAt: true,
        },
      });
      expect(result).toEqual({
        message: 'User created successfully',
        user: createdUser,
      });
    });

    it('should throw ConflictException if user already exists', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({
        id: 'existing-user-id',
        email: registerDto.email,
      });

      await expect(service.register(registerDto)).rejects.toThrow(
        ConflictException,
      );
      expect(mockPrismaService.user.findUnique).toHaveBeenCalledWith({
        where: { email: registerDto.email },
      });
      expect(mockPrismaService.user.create).not.toHaveBeenCalled();
    });

    it('should handle registration without name', async () => {
      const registerDtoWithoutName: RegisterDto = {
        email: 'test@example.com',
        password: 'password123',
      };
      const hashedPassword = 'hashed_password';
      const createdUser = {
        id: 'user-id-123',
        email: registerDtoWithoutName.email,
        name: null,
        createdAt: new Date(),
      };

      mockPrismaService.user.findUnique.mockResolvedValue(null);
      mockPrismaService.user.create.mockResolvedValue(createdUser);
      bcrypt.hash.mockResolvedValue(hashedPassword);

      const result = await service.register(registerDtoWithoutName);

      expect(mockPrismaService.user.create).toHaveBeenCalledWith({
        data: {
          email: registerDtoWithoutName.email,
          passwordHash: hashedPassword,
          name: null,
        },
        select: {
          id: true,
          email: true,
          name: true,
          createdAt: true,
        },
      });
      expect(result.user.name).toBeNull();
    });
  });

  describe('login', () => {
    const loginDto: LoginDto = {
      email: 'test@example.com',
      password: 'password123',
    };

    const mockUser = {
      id: 'user-id-123',
      email: loginDto.email,
      name: 'Test User',
      passwordHash: 'hashed_password',
    };

    it('should successfully login with valid credentials', async () => {
      const accessToken = 'access_token_123';
      const refreshToken = 'refresh_token_123';

      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      bcrypt.compare.mockResolvedValue(true);
      mockJwtService.sign
        .mockReturnValueOnce(accessToken)
        .mockReturnValueOnce(refreshToken);

      const result = await service.login(loginDto);

      expect(mockPrismaService.user.findUnique).toHaveBeenCalledWith({
        where: { email: loginDto.email },
      });
      expect(bcrypt.compare).toHaveBeenCalledWith(
        loginDto.password,
        mockUser.passwordHash,
      );
      expect(mockJwtService.sign).toHaveBeenCalledTimes(2);
      expect(result).toEqual({
        accessToken,
        refreshToken,
        user: {
          id: mockUser.id,
          email: mockUser.email,
          name: mockUser.name,
        },
      });
    });

    it('should throw UnauthorizedException if user not found', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      await expect(service.login(loginDto)).rejects.toThrow(
        UnauthorizedException,
      );
      expect(mockPrismaService.user.findUnique).toHaveBeenCalledWith({
        where: { email: loginDto.email },
      });
    });

    it('should throw UnauthorizedException if password is invalid', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      bcrypt.compare.mockResolvedValue(false);

      await expect(service.login(loginDto)).rejects.toThrow(
        UnauthorizedException,
      );
      expect(bcrypt.compare).toHaveBeenCalledWith(
        loginDto.password,
        mockUser.passwordHash,
      );
    });

    it('should throw UnauthorizedException if user has no password hash', async () => {
      const userWithoutPassword = { ...mockUser, passwordHash: null };
      mockPrismaService.user.findUnique.mockResolvedValue(userWithoutPassword);

      await expect(service.login(loginDto)).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('refresh', () => {
    const refreshToken = 'valid_refresh_token';
    const mockUser = {
      id: 'user-id-123',
      email: 'test@example.com',
      name: 'Test User',
    };

    it('should successfully refresh access token with valid refresh token', async () => {
      const newAccessToken = 'new_access_token';
      const payload = { id: mockUser.id };

      mockJwtService.verify.mockReturnValue(payload);
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      mockJwtService.sign.mockReturnValue(newAccessToken);

      const result = await service.refresh(refreshToken);

      expect(mockJwtService.verify).toHaveBeenCalledWith(refreshToken, {
        secret: process.env.JWT_SECRET,
      });
      expect(mockPrismaService.user.findUnique).toHaveBeenCalledWith({
        where: { id: payload.id },
      });
      expect(result).toEqual({ accessToken: newAccessToken });
    });

    it('should throw UnauthorizedException if refresh token is invalid', async () => {
      mockJwtService.verify.mockImplementation(() => {
        throw new Error('Invalid token');
      });

      await expect(service.refresh(refreshToken)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException if user not found', async () => {
      const payload = { id: 'non-existent-user-id' };
      mockJwtService.verify.mockReturnValue(payload);
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      await expect(service.refresh(refreshToken)).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });
});
