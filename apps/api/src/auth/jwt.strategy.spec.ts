import { JwtStrategy } from './jwt.strategy';

describe('JwtStrategy', () => {
  let strategy: JwtStrategy;
  const originalEnv = process.env.JWT_SECRET;

  beforeEach(() => {
    process.env.JWT_SECRET = 'test-secret-key';
    strategy = new JwtStrategy();
  });

  afterEach(() => {
    process.env.JWT_SECRET = originalEnv;
  });

  it('should be defined', () => {
    expect(strategy).toBeDefined();
  });

  it('should throw error if JWT_SECRET is not set', () => {
    delete process.env.JWT_SECRET;
    expect(() => new JwtStrategy()).toThrow();
  });

  describe('validate', () => {
    it('should return user object from JWT payload', async () => {
      const payload = {
        id: 'user-id-123',
        email: 'test@example.com',
        name: 'Test User',
      };

      const result = await strategy.validate(payload);

      expect(result).toEqual({
        id: payload.id,
        email: payload.email,
        name: payload.name,
      });
    });

    it('should handle payload without name', async () => {
      const payload = {
        id: 'user-id-123',
        email: 'test@example.com',
      };

      const result = await strategy.validate(payload);

      expect(result).toEqual({
        id: payload.id,
        email: payload.email,
        name: undefined,
      });
    });
  });
});

