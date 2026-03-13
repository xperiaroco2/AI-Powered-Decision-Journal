import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { Response, Request } from 'express';

describe('AuthController', () => {
  let controller: AuthController;
  let authService: AuthService;

  const mockAuthService = {
    register: jest.fn(),
    login: jest.fn(),
    refresh: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: mockAuthService,
        },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
    authService = module.get<AuthService>(AuthService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('register', () => {
    it('should register a new user', async () => {
      const registerDto: RegisterDto = {
        email: 'test@example.com',
        password: 'password123',
        name: 'Test User',
      };

      const expectedResult = {
        message: 'User created successfully',
        user: {
          id: 'user-id-123',
          email: registerDto.email,
          name: registerDto.name,
          createdAt: new Date(),
        },
      };

      mockAuthService.register.mockResolvedValue(expectedResult);

      const result = await controller.register(registerDto);

      expect(authService.register).toHaveBeenCalledWith(registerDto);
      expect(result).toEqual(expectedResult);
    });
  });

  describe('login', () => {
    it('should login user and set refresh token cookie', async () => {
      const loginDto: LoginDto = {
        email: 'test@example.com',
        password: 'password123',
      };

      const loginResult = {
        accessToken: 'access_token_123',
        refreshToken: 'refresh_token_123',
        user: {
          id: 'user-id-123',
          email: loginDto.email,
          name: 'Test User',
        },
      };

      mockAuthService.login.mockResolvedValue(loginResult);

      const mockResponse = {
        cookie: jest.fn(),
      } as unknown as Response;

      const result = await controller.login(loginDto, mockResponse);

      expect(authService.login).toHaveBeenCalledWith(loginDto);
      expect(mockResponse.cookie).toHaveBeenCalledWith(
        'refreshToken',
        loginResult.refreshToken,
        {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'strict',
          maxAge: 7 * 24 * 60 * 60 * 1000,
          path: '/',
        },
      );
      expect(result).toEqual({
        accessToken: loginResult.accessToken,
        user: loginResult.user,
      });
    });
  });

  describe('refresh', () => {
    it('should refresh access token using cookie', async () => {
      const refreshToken = 'valid_refresh_token';
      const newAccessToken = 'new_access_token';

      const mockRequest = {
        cookies: {
          refreshToken,
        },
      } as unknown as Request;

      mockAuthService.refresh.mockResolvedValue({
        accessToken: newAccessToken,
      });

      const result = await controller.refresh(mockRequest);

      expect(authService.refresh).toHaveBeenCalledWith(refreshToken);
      expect(result).toEqual({ accessToken: newAccessToken });
    });

    it('should throw error if refresh token cookie is missing', async () => {
      const mockRequest = {
        cookies: {},
      } as unknown as Request;

      await expect(controller.refresh(mockRequest)).rejects.toThrow(
        'Refresh token not found',
      );
      expect(authService.refresh).not.toHaveBeenCalled();
    });
  });

  describe('logout', () => {
    it('should clear refresh token cookie', async () => {
      const mockResponse = {
        cookie: jest.fn(),
      } as unknown as Response;

      const result = await controller.logout(mockResponse);

      expect(mockResponse.cookie).toHaveBeenCalledWith('refreshToken', '', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        path: '/',
        maxAge: 0,
      });
      expect(result).toEqual({ message: 'Logged out successfully' });
    });
  });
});
