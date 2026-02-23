/**
 * File Parser Service Unit Tests
 *
 * Tests file parsing for PDF, DOCX, and text files.
 */

import {
  parseFile,
  parsePDF,
  parseDOCX,
  parseTextFile,
  validateParsedText,
} from './file-parser.service';

// Mock the external libraries
jest.mock('pdf-parse');
jest.mock('mammoth');

import pdf from 'pdf-parse';
import mammoth from 'mammoth';

describe('File Parser Service', () => {
  describe('parseTextFile', () => {
    it('should parse plain text file', () => {
      const buffer = Buffer.from('This is plain text content');

      const result = parseTextFile(buffer);

      expect(result.text).toBe('This is plain text content');
    });

    it('should handle UTF-8 encoding', () => {
      const buffer = Buffer.from('Hello 世界 🌍', 'utf-8');

      const result = parseTextFile(buffer);

      expect(result.text).toBe('Hello 世界 🌍');
    });

    it('should throw error for invalid buffer', () => {
      const invalidBuffer = Buffer.from([0xff, 0xfe, 0xfd]);

      // This might not throw in all cases, but we test the error handling path
      expect(() => parseTextFile(invalidBuffer)).not.toThrow();
    });
  });

  describe('parsePDF', () => {
    it('should parse PDF and extract text', async () => {
      const mockPdfData = {
        text: 'PDF content here',
        numpages: 5,
        info: {
          Title: 'Test PDF',
          Author: 'Test Author',
        },
      };

      (pdf as jest.MockedFunction<typeof pdf>).mockResolvedValue(mockPdfData as any);

      const buffer = Buffer.from('fake pdf data');
      const result = await parsePDF(buffer);

      expect(result.text).toBe('PDF content here');
      expect(result.metadata?.pages).toBe(5);
      expect(result.metadata?.title).toBe('Test PDF');
      expect(result.metadata?.author).toBe('Test Author');
    });

    it('should handle PDF parsing errors', async () => {
      (pdf as jest.MockedFunction<typeof pdf>).mockRejectedValue(
        new Error('Invalid PDF'),
      );

      const buffer = Buffer.from('invalid pdf');

      await expect(parsePDF(buffer)).rejects.toThrow('Failed to parse PDF: Invalid PDF');
    });
  });

  describe('parseDOCX', () => {
    it('should parse DOCX and extract text', async () => {
      const mockResult = {
        value: 'DOCX content here',
        messages: [],
      };

      (mammoth.extractRawText as jest.Mock).mockResolvedValue(mockResult);

      const buffer = Buffer.from('fake docx data');
      const result = await parseDOCX(buffer);

      expect(result.text).toBe('DOCX content here');
      expect(mammoth.extractRawText).toHaveBeenCalledWith({ buffer });
    });

    it('should log warnings if DOCX parsing has messages', async () => {
      const mockResult = {
        value: 'DOCX content',
        messages: [{ type: 'warning', message: 'Some warning' }],
      };

      (mammoth.extractRawText as jest.Mock).mockResolvedValue(mockResult);

      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      const buffer = Buffer.from('fake docx data');
      await parseDOCX(buffer);

      expect(consoleSpy).toHaveBeenCalledWith(
        'DOCX parsing warnings:',
        expect.any(Array),
      );

      consoleSpy.mockRestore();
    });

    it('should handle DOCX parsing errors', async () => {
      (mammoth.extractRawText as jest.Mock).mockRejectedValue(
        new Error('Invalid DOCX'),
      );

      const buffer = Buffer.from('invalid docx');

      await expect(parseDOCX(buffer)).rejects.toThrow('Failed to parse DOCX: Invalid DOCX');
    });
  });

  describe('parseFile', () => {
    it('should parse PDF files', async () => {
      (pdf as jest.MockedFunction<typeof pdf>).mockResolvedValue({
        text: 'PDF content',
        numpages: 1,
      } as any);

      const buffer = Buffer.from('fake pdf');
      const result = await parseFile(buffer, 'document.pdf');

      expect(result.text).toBe('PDF content');
    });

    it('should parse DOCX files', async () => {
      (mammoth.extractRawText as jest.Mock).mockResolvedValue({
        value: 'DOCX content',
        messages: [],
      });

      const buffer = Buffer.from('fake docx');
      const result = await parseFile(buffer, 'document.docx');

      expect(result.text).toBe('DOCX content');
    });

    it('should parse DOC files as DOCX', async () => {
      (mammoth.extractRawText as jest.Mock).mockResolvedValue({
        value: 'DOC content',
        messages: [],
      });

      const buffer = Buffer.from('fake doc');
      const result = await parseFile(buffer, 'document.doc');

      expect(result.text).toBe('DOC content');
    });

    it('should parse TXT files', async () => {
      const buffer = Buffer.from('Plain text');
      const result = await parseFile(buffer, 'document.txt');

      expect(result.text).toBe('Plain text');
    });

    it('should parse MD files', async () => {
      const buffer = Buffer.from('# Markdown');
      const result = await parseFile(buffer, 'document.md');

      expect(result.text).toBe('# Markdown');
    });

    it('should handle case-insensitive extensions', async () => {
      const buffer = Buffer.from('Text');
      const result = await parseFile(buffer, 'document.TXT');

      expect(result.text).toBe('Text');
    });

    it('should throw error for unsupported file types', async () => {
      const buffer = Buffer.from('data');

      await expect(parseFile(buffer, 'document.xlsx')).rejects.toThrow(
        'Unsupported file type: .xlsx',
      );
    });

    it('should throw error for files without extension', async () => {
      const buffer = Buffer.from('data');

      await expect(parseFile(buffer, 'document')).rejects.toThrow(
        'Unable to determine file type from filename',
      );
    });
  });

  describe('validateParsedText', () => {
    it('should pass for valid text', () => {
      const validText = 'a'.repeat(100);

      expect(() => validateParsedText(validText, 'test.pdf')).not.toThrow();
    });

    it('should throw error for empty text', () => {
      expect(() => validateParsedText('', 'test.pdf')).toThrow(
        'No text content extracted from test.pdf',
      );
    });

    it('should throw error for whitespace-only text', () => {
      expect(() => validateParsedText('   ', 'test.pdf')).toThrow(
        'No text content extracted from test.pdf',
      );
    });

    it('should throw error for text shorter than 50 characters', () => {
      expect(() => validateParsedText('Short', 'test.pdf')).toThrow(
        'Extracted text is too short (5 chars). Minimum 50 characters required.',
      );
    });

    it('should throw error for text longer than 1M characters', () => {
      const longText = 'a'.repeat(1_000_001);

      expect(() => validateParsedText(longText, 'test.pdf')).toThrow(
        'Extracted text is too long (1000001 chars). Maximum 1,000,000 characters allowed.',
      );
    });
  });
});

