/**
 * Event Publisher Service Unit Tests
 *
 * Tests Redis pub/sub event publishing for real-time updates.
 */

import {
  publishRunUpdate,
  publishAttachmentUpdate,
  EVENTS_CHANNEL,
} from './event-publisher';

// Mock logger — factory must not reference outer const (jest hoisting TDZ issue)
jest.mock('../logger', () => ({
  childLogger: jest.fn(() => ({ info: jest.fn(), error: jest.fn(), warn: jest.fn() })),
}));

// Mock ioredis module
const mockPublish = jest.fn().mockResolvedValue(1);
const mockOn = jest.fn();

jest.mock('ioredis', () => {
  return {
    Redis: jest.fn().mockImplementation(() => ({
      publish: mockPublish,
      on: mockOn,
    })),
  };
});

describe('Event Publisher Service', () => {
  let originalEnv: NodeJS.ProcessEnv;
  let mockLog: { info: jest.Mock; error: jest.Mock; warn: jest.Mock };

  beforeAll(() => {
    const { childLogger } = jest.requireMock('../logger') as { childLogger: jest.Mock };
    mockLog = childLogger.mock.results[0]?.value;
  });

  beforeEach(() => {
    // Save original environment
    originalEnv = { ...process.env };

    // Set REDIS_URL
    process.env.REDIS_URL = 'redis://localhost:6379';

    // Clear mock calls
    mockPublish.mockClear();
    mockOn.mockClear();
    mockPublish.mockResolvedValue(1);
    mockLog?.info?.mockClear();
    mockLog?.error?.mockClear();
  });

  afterEach(() => {
    // Restore original environment
    process.env = originalEnv;

    // Clear all mocks
    jest.clearAllMocks();
  });

  describe('publishRunUpdate', () => {
    it('should publish decision update event with correct format', async () => {
      await publishRunUpdate('decision-123', 'run-456', 'PROCESSING');

      expect(mockPublish).toHaveBeenCalledWith(
        EVENTS_CHANNEL,
        JSON.stringify({
          type: 'decision:update',
          decisionId: 'decision-123',
          runId: 'run-456',
          status: 'PROCESSING',
        }),
      );
    });

    it('should publish COMPLETED status', async () => {
      await publishRunUpdate('decision-123', 'run-456', 'COMPLETED');

      expect(mockPublish).toHaveBeenCalledWith(
        EVENTS_CHANNEL,
        expect.stringContaining('"status":"COMPLETED"'),
      );
    });

    it('should publish FAILED status', async () => {
      await publishRunUpdate('decision-123', 'run-456', 'FAILED');

      expect(mockPublish).toHaveBeenCalledWith(
        EVENTS_CHANNEL,
        expect.stringContaining('"status":"FAILED"'),
      );
    });

    it('should log success message', async () => {
      await publishRunUpdate('decision-123', 'run-456', 'PROCESSING');

      expect(mockLog.info).toHaveBeenCalledWith(
        expect.objectContaining({ decisionId: 'decision-123', runId: 'run-456', status: 'PROCESSING' }),
        'Published decision event',
      );
    });

    it('should not throw error if publishing fails', async () => {
      mockPublish.mockRejectedValue(new Error('Redis error'));

      await expect(
        publishRunUpdate('decision-123', 'run-456', 'PROCESSING'),
      ).resolves.not.toThrow();

      expect(mockLog.error).toHaveBeenCalledWith(
        expect.objectContaining({ err: expect.any(Error) }),
        'Failed to publish event',
      );
    });
  });

  describe('publishAttachmentUpdate', () => {
    it('should publish attachment update event with correct format', async () => {
      await publishAttachmentUpdate(
        'attachment-123',
        'decision-456',
        'PROCESSING',
      );

      expect(mockPublish).toHaveBeenCalledWith(
        EVENTS_CHANNEL,
        JSON.stringify({
          type: 'attachment:update',
          attachmentId: 'attachment-123',
          decisionId: 'decision-456',
          status: 'PROCESSING',
        }),
      );
    });

    it('should include error message when provided', async () => {
      await publishAttachmentUpdate(
        'attachment-123',
        'decision-456',
        'FAILED',
        'Parse error',
      );

      expect(mockPublish).toHaveBeenCalledWith(
        EVENTS_CHANNEL,
        JSON.stringify({
          type: 'attachment:update',
          attachmentId: 'attachment-123',
          decisionId: 'decision-456',
          status: 'FAILED',
          error: 'Parse error',
        }),
      );
    });

    it('should publish READY status', async () => {
      await publishAttachmentUpdate('attachment-123', 'decision-456', 'READY');

      expect(mockPublish).toHaveBeenCalledWith(
        EVENTS_CHANNEL,
        expect.stringContaining('"status":"READY"'),
      );
    });

    it('should log success message', async () => {
      await publishAttachmentUpdate(
        'attachment-123',
        'decision-456',
        'PROCESSING',
      );

      expect(mockLog.info).toHaveBeenCalledWith(
        expect.objectContaining({ attachmentId: 'attachment-123', decisionId: 'decision-456', status: 'PROCESSING' }),
        'Published attachment event',
      );
    });

    it('should not throw error if publishing fails', async () => {
      mockPublish.mockRejectedValue(new Error('Redis error'));

      await expect(
        publishAttachmentUpdate('attachment-123', 'decision-456', 'PROCESSING'),
      ).resolves.not.toThrow();

      expect(mockLog.error).toHaveBeenCalledWith(
        expect.objectContaining({ err: expect.any(Error) }),
        'Failed to publish attachment event',
      );
    });
  });

  describe('EVENTS_CHANNEL', () => {
    it('should export the correct channel name', () => {
      expect(EVENTS_CHANNEL).toBe('decision-events');
    });
  });
});
