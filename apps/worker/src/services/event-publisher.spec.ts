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

  beforeEach(() => {
    // Save original environment
    originalEnv = { ...process.env };

    // Set REDIS_URL
    process.env.REDIS_URL = 'redis://localhost:6379';

    // Clear mock calls
    mockPublish.mockClear();
    mockOn.mockClear();
    mockPublish.mockResolvedValue(1);
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
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      await publishRunUpdate('decision-123', 'run-456', 'PROCESSING');

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('📡 Published event: PROCESSING'),
      );

      consoleSpy.mockRestore();
    });

    it('should not throw error if publishing fails', async () => {
      mockPublish.mockRejectedValue(new Error('Redis error'));

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      await expect(
        publishRunUpdate('decision-123', 'run-456', 'PROCESSING'),
      ).resolves.not.toThrow();

      expect(consoleSpy).toHaveBeenCalledWith(
        'Failed to publish event:',
        expect.any(Error),
      );

      consoleSpy.mockRestore();
    });
  });

  describe('publishAttachmentUpdate', () => {
    it('should publish attachment update event with correct format', async () => {
      await publishAttachmentUpdate('attachment-123', 'decision-456', 'PROCESSING');

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
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      await publishAttachmentUpdate('attachment-123', 'decision-456', 'PROCESSING');

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('📡 Published attachment event: PROCESSING'),
      );

      consoleSpy.mockRestore();
    });

    it('should not throw error if publishing fails', async () => {
      mockPublish.mockRejectedValue(new Error('Redis error'));

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      await expect(
        publishAttachmentUpdate('attachment-123', 'decision-456', 'PROCESSING'),
      ).resolves.not.toThrow();

      expect(consoleSpy).toHaveBeenCalledWith(
        'Failed to publish attachment event:',
        expect.any(Error),
      );

      consoleSpy.mockRestore();
    });
  });

  describe('EVENTS_CHANNEL', () => {
    it('should export the correct channel name', () => {
      expect(EVENTS_CHANNEL).toBe('decision-events');
    });
  });
});

