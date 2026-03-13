/**
 * Decisions Integration Tests
 *
 * Tests the full decisions CRUD flow with real database and queue.
 * These tests use a real NestJS application instance and test database.
 */

import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PrismaClient, DecisionStatus } from '@prisma/client';
import {
  createTestApp,
  createTestPrismaClient,
  cleanupDatabase,
  createTestUser,
  createTestDecision,
  extractAccessToken,
  waitFor,
} from './helpers/test-helpers';
import * as bcrypt from 'bcryptjs';

describe('Decisions Integration Tests', () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  let accessToken: string;
  let userId: string;

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
  });

  describe('GET /decisions', () => {
    it('should return empty array when user has no decisions', async () => {
      const response = await request(app.getHttpServer())
        .get('/decisions')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body).toEqual([]);
    });

    it('should return all decisions for the user', async () => {
      // Create test decisions
      await createTestDecision(prisma, {
        userId,
        situation: 'Should I switch jobs?',
        chosenDecision: 'Yes, I will switch',
        personalReasoning: 'Better salary and growth',
      });

      await createTestDecision(prisma, {
        userId,
        situation: 'Should I buy a house?',
        chosenDecision: 'No, I will rent',
      });

      const response = await request(app.getHttpServer())
        .get('/decisions')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body).toHaveLength(2);
      expect(response.body[0]).toMatchObject({
        situation: expect.any(String),
        chosenDecision: expect.any(String),
        status: expect.any(String),
      });
    });

    it('should not return decisions from other users', async () => {
      // Create another user
      const otherPasswordHash = await bcrypt.hash('password123', 10);
      const otherUser = await createTestUser(prisma, {
        email: 'other@example.com',
        passwordHash: otherPasswordHash,
      });

      // Create decision for other user
      await createTestDecision(prisma, {
        userId: otherUser.id,
        situation: 'Other user decision',
        chosenDecision: 'Other decision',
      });

      // Create decision for current user
      await createTestDecision(prisma, {
        userId,
        situation: 'My decision',
        chosenDecision: 'My choice',
      });

      const response = await request(app.getHttpServer())
        .get('/decisions')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body).toHaveLength(1);
      expect(response.body[0].situation).toBe('My decision');
    });

    it('should return decisions ordered by createdAt desc', async () => {
      // Create decisions with slight delay to ensure different timestamps
      const decision1 = await createTestDecision(prisma, {
        userId,
        situation: 'First decision',
        chosenDecision: 'First',
      });

      await new Promise((resolve) => setTimeout(resolve, 10));

      const decision2 = await createTestDecision(prisma, {
        userId,
        situation: 'Second decision',
        chosenDecision: 'Second',
      });

      const response = await request(app.getHttpServer())
        .get('/decisions')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body[0].id).toBe(decision2.id); // Most recent first
      expect(response.body[1].id).toBe(decision1.id);
    });
  });

  describe('GET /decisions/:id', () => {
    let decisionId: string;

    beforeEach(async () => {
      const decision = await createTestDecision(prisma, {
        userId,
        situation: 'Test decision',
        chosenDecision: 'Test choice',
        personalReasoning: 'Test reasoning',
      });

      decisionId = decision.id;
    });

    it('should return decision with all details', async () => {
      const response = await request(app.getHttpServer())
        .get(`/decisions/${decisionId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        id: decisionId,
        situation: 'Test decision',
        chosenDecision: 'Test choice',
        personalReasoning: 'Test reasoning',
        status: DecisionStatus.PENDING,
        userId,
      });

      expect(response.body.runs).toBeDefined();
      expect(Array.isArray(response.body.runs)).toBe(true);
    });

    it('should return 404 for non-existent decision', async () => {
      await request(app.getHttpServer())
        .get('/decisions/non-existent-id')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(404);
    });

    it('should return 403 when accessing another user decision', async () => {
      // Create another user
      const otherPasswordHash = await bcrypt.hash('password123', 10);
      const otherUser = await createTestUser(prisma, {
        email: 'other@example.com',
        passwordHash: otherPasswordHash,
      });

      // Create decision for other user
      const otherDecision = await createTestDecision(prisma, {
        userId: otherUser.id,
        situation: 'Other user decision',
        chosenDecision: 'Other choice',
      });

      await request(app.getHttpServer())
        .get(`/decisions/${otherDecision.id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(403);
    });
  });

  describe('POST /decisions', () => {
    it('should create decision with reasoning', async () => {
      const response = await request(app.getHttpServer())
        .post('/decisions')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          situation: 'Should I learn TypeScript?',
          chosenDecision: 'Yes, I will learn it',
          personalReasoning: 'It will improve my code quality',
        })
        .expect(201);

      expect(response.body).toMatchObject({
        situation: 'Should I learn TypeScript?',
        chosenDecision: 'Yes, I will learn it',
        personalReasoning: 'It will improve my code quality',
        status: DecisionStatus.PENDING,
        userId,
      });

      expect(response.body.id).toBeDefined();

      // Verify decision was created in database
      const decision = await prisma.decision.findUnique({
        where: { id: response.body.id },
      });

      expect(decision).toBeDefined();
      expect(decision?.situation).toBe('Should I learn TypeScript?');
    });

    it('should create decision without reasoning', async () => {
      const response = await request(app.getHttpServer())
        .post('/decisions')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          situation:
            'Should I exercise today? I am feeling tired but I know it would be good for my health.',
          chosenDecision: 'Yes, I will exercise',
        })
        .expect(201);

      expect(response.body.personalReasoning).toBeNull();
    });

    it('should reject invalid decision data', async () => {
      await request(app.getHttpServer())
        .post('/decisions')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          situation: '', // Empty situation
          chosenDecision: 'Yes',
        })
        .expect(400);
    });

    it('should create analysis run and queue analysis job', async () => {
      const response = await request(app.getHttpServer())
        .post('/decisions')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          situation: 'Should I start a business?',
          chosenDecision: 'Yes, I will start',
          personalReasoning: 'I have a good idea',
        })
        .expect(201);

      const decisionId = response.body.id;

      // Wait a bit for async operations
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Verify analysis run was created
      const runs = await prisma.decisionAnalysisRun.findMany({
        where: { decisionId },
      });

      expect(runs).toHaveLength(1);
      expect(runs[0].status).toBe('PENDING');
    });
  });

  describe('POST /decisions/:id/rerun', () => {
    let decisionId: string;

    beforeEach(async () => {
      const decision = await createTestDecision(prisma, {
        userId,
        situation: 'Test decision',
        chosenDecision: 'Test choice',
      });

      decisionId = decision.id;

      // Create an initial analysis run
      await prisma.decisionAnalysisRun.create({
        data: {
          decisionId,
          status: 'COMPLETED',
          provider: 'mock',
          resultJson: {
            category: 'CAREER',
            cognitiveBiases: [],
            missedAlternatives: [],
            insights: [],
          },
          categoryText: 'CAREER',
          biasesText: [],
        },
      });
    });

    it('should create new analysis run', async () => {
      const response = await request(app.getHttpServer())
        .post(`/decisions/${decisionId}/rerun`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.message).toBe('Analysis rerun initiated');

      // Verify new run was created
      const runs = await prisma.decisionAnalysisRun.findMany({
        where: { decisionId },
        orderBy: { createdAt: 'desc' },
      });

      expect(runs).toHaveLength(2);
      expect(runs[0].status).toBe('PENDING');
    });

    it('should return 404 for non-existent decision', async () => {
      await request(app.getHttpServer())
        .post('/decisions/non-existent-id/rerun')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(404);
    });

    it('should return 403 when rerunning another user decision', async () => {
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
        .post(`/decisions/${otherDecision.id}/rerun`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(403);
    });
  });
});
