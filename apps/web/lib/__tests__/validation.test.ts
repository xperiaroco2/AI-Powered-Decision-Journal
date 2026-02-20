import {
  countWords,
  validateSituation,
  validateDecision,
  validateReasoning,
} from '../validation';

describe('validation utilities', () => {
  describe('countWords', () => {
    it('should count words correctly', () => {
      expect(countWords('hello world')).toBe(2);
      expect(countWords('one two three four five')).toBe(5);
      expect(countWords('  spaced   out   words  ')).toBe(3);
      expect(countWords('')).toBe(0);
      expect(countWords('   ')).toBe(0);
    });
  });

  describe('validateSituation', () => {
    it('should validate valid situation', () => {
      const result = validateSituation(
        'This is a valid situation with more than ten words in it',
      );
      expect(result.isValid).toBe(true);
      expect(result.error).toBeUndefined();
      expect(result.warning).toBeUndefined();
    });

    it('should reject empty situation', () => {
      const result = validateSituation('');
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Situation is required');
    });

    it('should warn on brief situation', () => {
      const result = validateSituation('Too brief');
      expect(result.isValid).toBe(true);
      expect(result.warning).toContain('Too brief');
      expect(result.warning).toContain('2 words');
    });

    it('should reject situation that is too long', () => {
      const longText = 'word '.repeat(501);
      const result = validateSituation(longText);
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('too long');
    });
  });

  describe('validateDecision', () => {
    it('should validate valid decision', () => {
      const result = validateDecision('Should I switch jobs');
      expect(result.isValid).toBe(true);
      expect(result.error).toBeUndefined();
      expect(result.warning).toBeUndefined();
    });

    it('should reject empty decision', () => {
      const result = validateDecision('');
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Decision is required');
    });

    it('should warn on brief decision', () => {
      const result = validateDecision('Go');
      expect(result.isValid).toBe(true);
      expect(result.warning).toContain('Too brief');
      expect(result.warning).toContain('1 words');
    });

    it('should reject decision that is too long', () => {
      const longText = 'word '.repeat(101);
      const result = validateDecision(longText);
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('too long');
    });
  });

  describe('validateReasoning', () => {
    it('should validate valid reasoning', () => {
      const result = validateReasoning(
        'This is valid reasoning with more than ten words in it',
      );
      expect(result.isValid).toBe(true);
      expect(result.error).toBeUndefined();
      expect(result.warning).toBeUndefined();
    });

    it('should reject empty reasoning', () => {
      const result = validateReasoning('');
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Reasoning is required');
    });

    it('should warn on brief reasoning', () => {
      const result = validateReasoning('Too brief');
      expect(result.isValid).toBe(true);
      expect(result.warning).toContain('Too brief');
      expect(result.warning).toContain('2 words');
    });

    it('should reject reasoning that is too long', () => {
      const longText = 'word '.repeat(501);
      const result = validateReasoning(longText);
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('too long');
    });
  });
});

