/**
 * Auth Integration Tests
 *
 * Tests the full auth flow with real database and Redis.
 * These tests use a real NestJS application instance and test database.
 */

import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PrismaClient } from '@prisma/client';
import {
  createTestApp,
  createTestPrismaClient,
  cleanupDatabase,
  extractAccessToken,
  extractRefreshToken,
} from './helpers/test-helpers';

describe('Auth Integration Tests', () => {
  let app: INestApplication;
  let prisma: PrismaClient;

  beforeAll(async () => {
    prisma = createTestPrismaClient();
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    await cleanupDatabase(prisma);
  });

  describe('POST /auth/register', () => {
    it('should register a new user successfully', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          email: 'test@example.com',
          password: 'password123',
          name: 'Test User',
        })
        .expect(201);

      expect(response.body).toMatchObject({
        message: 'User created successfully',
        user: {
          email: 'test@example.com',
          name: 'Test User',
        },
      });

      expect(response.body.user.id).toBeDefined();
      expect(response.body.user.passwordHash).toBeUndefined(); // Should not expose password hash

      // Verify user was created in database
      const user = await prisma.user.findUnique({
        where: { email: 'test@example.com' },
      });

      expect(user).toBeDefined();
      expect(user?.email).toBe('test@example.com');
      expect(user?.name).toBe('Test User');
      expect(user?.passwordHash).toBeDefined();
    });

    it('should register a user without name', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          email: 'test@example.com',
          password: 'password123',
        })
        .expect(201);

      expect(response.body.user.name).toBeNull();

      const user = await prisma.user.findUnique({
        where: { email: 'test@example.com' },
      });

      expect(user?.name).toBeNull();
    });

    it('should reject duplicate email', async () => {
      // Create first user
      await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          email: 'test@example.com',
          password: 'password123',
        })
        .expect(201);

      // Try to create second user with same email
      const response = await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          email: 'test@example.com',
          password: 'different-password',
        })
        .expect(409);

      expect(response.body.message).toContain('already exists');
    });

    it('should reject invalid email', async () => {
      await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          email: 'not-an-email',
          password: 'password123',
        })
        .expect(400);
    });

    it('should reject weak password', async () => {
      await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          email: 'test@example.com',
          password: '123', // Too short
        })
        .expect(400);
    });
  });

  describe('POST /auth/login', () => {
    beforeEach(async () => {
      // Create a test user
      await request(app.getHttpServer()).post('/auth/register').send({
        email: 'test@example.com',
        password: 'password123',
        name: 'Test User',
      });
    });

    it('should login successfully with valid credentials', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: 'test@example.com',
          password: 'password123',
        })
        .expect(200);

      expect(response.body).toMatchObject({
        user: {
          email: 'test@example.com',
          name: 'Test User',
        },
      });

      expect(response.body.accessToken).toBeDefined();
      expect(response.body.user.id).toBeDefined();
      expect(response.body.user.passwordHash).toBeUndefined();

      // Check that refresh token cookie was set
      const cookies = response.headers['set-cookie'] as unknown as
        | string[]
        | undefined;
      expect(cookies).toBeDefined();
      expect(cookies?.some((c: string) => c.startsWith('refreshToken='))).toBe(
        true,
      );
    });

    it('should reject invalid password', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: 'test@example.com',
          password: 'wrong-password',
        })
        .expect(401);

      expect(response.body.message).toContain('Invalid credentials');
    });

    it('should reject non-existent user', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: 'nonexistent@example.com',
          password: 'password123',
        })
        .expect(401);

      expect(response.body.message).toContain('Invalid credentials');
    });

    it('should set httpOnly cookie for refresh token', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: 'test@example.com',
          password: 'password123',
        })
        .expect(200);

      const cookies = response.headers['set-cookie'] as unknown as
        | string[]
        | undefined;
      const refreshTokenCookie = cookies?.find((c: string) =>
        c.startsWith('refreshToken='),
      );

      expect(refreshTokenCookie).toBeDefined();
      expect(refreshTokenCookie).toContain('HttpOnly');
      expect(refreshTokenCookie).toContain('Path=/');
    });
  });

  describe('POST /auth/refresh', () => {
    let refreshToken: string;

    beforeEach(async () => {
      // Register and login to get refresh token
      await request(app.getHttpServer()).post('/auth/register').send({
        email: 'test@example.com',
        password: 'password123',
      });

      const loginResponse = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: 'test@example.com',
          password: 'password123',
        });

      refreshToken = extractRefreshToken(loginResponse);
    });

    it('should refresh access token with valid refresh token', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/refresh')
        .set('Cookie', [`refreshToken=${refreshToken}`])
        .expect(200);

      expect(response.body.accessToken).toBeDefined();
      expect(typeof response.body.accessToken).toBe('string');
    });

    it('should reject request without refresh token', async () => {
      await request(app.getHttpServer()).post('/auth/refresh').expect(401);
    });

    it('should reject invalid refresh token', async () => {
      await request(app.getHttpServer())
        .post('/auth/refresh')
        .set('Cookie', ['refreshToken=invalid-token'])
        .expect(401);
    });
  });

  describe('POST /auth/logout', () => {
    beforeEach(async () => {
      // Register and login
      await request(app.getHttpServer()).post('/auth/register').send({
        email: 'test@example.com',
        password: 'password123',
      });

      await request(app.getHttpServer()).post('/auth/login').send({
        email: 'test@example.com',
        password: 'password123',
      });
    });

    it('should logout successfully', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/logout')
        .expect(200);

      expect(response.body.message).toBe('Logged out successfully');

      // Check that refresh token cookie was cleared
      const cookies = response.headers['set-cookie'] as unknown as
        | string[]
        | undefined;
      expect(cookies).toBeDefined();

      const refreshTokenCookie = cookies?.find((c: string) =>
        c.startsWith('refreshToken='),
      );

      expect(refreshTokenCookie).toBeDefined();
      expect(refreshTokenCookie).toContain('Max-Age=0'); // Cookie should be expired
    });
  });

  describe('Protected Routes', () => {
    let accessToken: string;

    beforeEach(async () => {
      // Register and login
      await request(app.getHttpServer()).post('/auth/register').send({
        email: 'test@example.com',
        password: 'password123',
      });

      const loginResponse = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: 'test@example.com',
          password: 'password123',
        });

      accessToken = extractAccessToken(loginResponse);
    });

    it('should access protected route with valid token', async () => {
      const response = await request(app.getHttpServer())
        .get('/decisions')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });

    it('should reject protected route without token', async () => {
      await request(app.getHttpServer()).get('/decisions').expect(401);
    });

    it('should reject protected route with invalid token', async () => {
      await request(app.getHttpServer())
        .get('/decisions')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);
    });
  });
});
