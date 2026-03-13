/**
 * Attachments Integration Tests
 *
 * Tests the full attachments flow with real database and file uploads.
 * These tests use a real NestJS application instance and test database.
 */

import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PrismaClient, AttachmentStatus } from '@prisma/client';
import {
  createTestApp,
  createTestPrismaClient,
  cleanupDatabase,
  createTestUser,
  createTestDecision,
  extractAccessToken,
} from './helpers/test-helpers';
import * as bcrypt from 'bcryptjs';

describe('Attachments Integration Tests', () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  let accessToken: string;
  let userId: string;
  let decisionId: string;

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

    // Create and login a test user
    const passwordHash = await bcrypt.hash('password123', 10);
    const user = await createTestUser(prisma, {
      email: 'test@example.com',
      passwordHash,
      name: 'Test User',
    });

    userId = user.id;

    const loginResponse = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        email: 'test@example.com',
        password: 'password123',
      });

    accessToken = extractAccessToken(loginResponse);

    // Create a test decision
    const decision = await createTestDecision(prisma, {
      userId,
      situation: 'Should I accept the job offer?',
      chosenDecision: 'Yes, I will accept',
    });

    decisionId = decision.id;
  });

  describe('GET /attachments', () => {
    it('should return empty array when user has no attachments', async () => {
      const response = await request(app.getHttpServer())
        .get('/attachments')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body).toEqual({ attachments: [] });
    });

    it('should return all attachments for the user', async () => {
      // Create test attachments
      await prisma.attachment.create({
        data: {
          userId,
          decisionId,
          title: 'Employment Contract',
          content: 'This is the employment contract...',
          status: AttachmentStatus.READY,
        },
      });

      await prisma.attachment.create({
        data: {
          userId,
          decisionId,
          title: 'Benefits Package',
          content: 'This is the benefits package...',
          status: AttachmentStatus.PENDING,
        },
      });

      const response = await request(app.getHttpServer())
        .get('/attachments')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.attachments).toHaveLength(2);
      expect(response.body.attachments[0]).toMatchObject({
        title: expect.any(String),
        status: expect.any(String),
      });
    });

    it('should not return attachments from other users', async () => {
      // Create another user
      const otherPasswordHash = await bcrypt.hash('password123', 10);
      const otherUser = await createTestUser(prisma, {
        email: 'other@example.com',
        passwordHash: otherPasswordHash,
      });

      // Create decision for other user
      const otherDecision = await createTestDecision(prisma, {
        userId: otherUser.id,
        situation: 'Other decision',
        chosenDecision: 'Other choice',
      });

      // Create attachment for other user
      await prisma.attachment.create({
        data: {
          userId: otherUser.id,
          decisionId: otherDecision.id,
          title: 'Other attachment',
          content: 'Other content',
        },
      });

      // Create attachment for current user
      await prisma.attachment.create({
        data: {
          userId,
          decisionId,
          title: 'My attachment',
          content: 'My content',
        },
      });

      const response = await request(app.getHttpServer())
        .get('/attachments')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.attachments).toHaveLength(1);
      expect(response.body.attachments[0].title).toBe('My attachment');
    });
  });

  describe('GET /decisions/:decisionId/attachments', () => {
    it('should return attachments for specific decision', async () => {
      // Create another decision
      const decision2 = await createTestDecision(prisma, {
        userId,
        situation: 'Another decision',
        chosenDecision: 'Another choice',
      });

      // Create attachments for first decision
      await prisma.attachment.create({
        data: {
          userId,
          decisionId,
          title: 'Attachment 1',
          content: 'Content 1',
        },
      });

      // Create attachment for second decision
      await prisma.attachment.create({
        data: {
          userId,
          decisionId: decision2.id,
          title: 'Attachment 2',
          content: 'Content 2',
        },
      });

      const response = await request(app.getHttpServer())
        .get(`/decisions/${decisionId}/attachments`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.attachments).toHaveLength(1);
      expect(response.body.attachments[0].title).toBe('Attachment 1');
    });

    it('should return 403 when accessing another user decision attachments', async () => {
      // Create another user
      const otherPasswordHash = await bcrypt.hash('password123', 10);
      const otherUser = await createTestUser(prisma, {
        email: 'other@example.com',
        passwordHash: otherPasswordHash,
      });

      // Create decision for other user
      const otherDecision = await createTestDecision(prisma, {
        userId: otherUser.id,
        situation: 'Other decision',
        chosenDecision: 'Other choice',
      });

      await request(app.getHttpServer())
        .get(`/decisions/${otherDecision.id}/attachments`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(403);
    });
  });

  describe('POST /decisions/:decisionId/attachments', () => {
    it('should upload text file successfully', async () => {
      const fileContent = 'This is a test document with important information.';
      const buffer = Buffer.from(fileContent);

      const response = await request(app.getHttpServer())
        .post(`/decisions/${decisionId}/attachments`)
        .set('Authorization', `Bearer ${accessToken}`)
        .field('title', 'Test Document')
        .attach('file', buffer, 'test.txt')
        .expect(201);

      expect(response.body).toMatchObject({
        title: 'Test Document',
        status: AttachmentStatus.PENDING,
        decisionId,
      });

      expect(response.body.id).toBeDefined();
      expect(response.body.createdAt).toBeDefined();

      // Verify attachment was created in database
      const attachment = await prisma.attachment.findUnique({
        where: { id: response.body.id },
      });

      expect(attachment).toBeDefined();
      // Content is stored as base64
      const decodedContent = Buffer.from(
        attachment?.content || '',
        'base64',
      ).toString('utf-8');
      expect(decodedContent).toBe(fileContent);
    });

    it('should reject upload without file', async () => {
      await request(app.getHttpServer())
        .post(`/decisions/${decisionId}/attachments`)
        .set('Authorization', `Bearer ${accessToken}`)
        .field('title', 'Test Document')
        .expect(400);
    });

    it('should reject upload without title', async () => {
      const buffer = Buffer.from('Test content');

      await request(app.getHttpServer())
        .post(`/decisions/${decisionId}/attachments`)
        .set('Authorization', `Bearer ${accessToken}`)
        .attach('file', buffer, 'test.txt')
        .expect(400);
    });

    it('should reject upload to non-existent decision', async () => {
      const buffer = Buffer.from('Test content');

      await request(app.getHttpServer())
        .post('/decisions/non-existent-id/attachments')
        .set('Authorization', `Bearer ${accessToken}`)
        .field('title', 'Test Document')
        .attach('file', buffer, 'test.txt')
        .expect(404);
    });

    it('should reject upload to another user decision', async () => {
      // Create another user
      const otherPasswordHash = await bcrypt.hash('password123', 10);
      const otherUser = await createTestUser(prisma, {
        email: 'other@example.com',
        passwordHash: otherPasswordHash,
      });

      // Create decision for other user
      const otherDecision = await createTestDecision(prisma, {
        userId: otherUser.id,
        situation: 'Other decision',
        chosenDecision: 'Other choice',
      });

      const buffer = Buffer.from('Test content');

      await request(app.getHttpServer())
        .post(`/decisions/${otherDecision.id}/attachments`)
        .set('Authorization', `Bearer ${accessToken}`)
        .field('title', 'Test Document')
        .attach('file', buffer, 'test.txt')
        .expect(403);
    });

    it('should handle large text files', async () => {
      // Create a large text file (10KB)
      const largeContent = 'Lorem ipsum dolor sit amet. '.repeat(400);
      const buffer = Buffer.from(largeContent);

      const response = await request(app.getHttpServer())
        .post(`/decisions/${decisionId}/attachments`)
        .set('Authorization', `Bearer ${accessToken}`)
        .field('title', 'Large Document')
        .attach('file', buffer, 'large.txt')
        .expect(201);

      // Content is not returned in the response (it's stored in the database)
      expect(response.body).toMatchObject({
        title: 'Large Document',
        status: AttachmentStatus.PENDING,
        decisionId,
      });
    });
  });
});
