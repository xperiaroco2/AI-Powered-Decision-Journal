import pdf from "pdf-parse";
import mammoth from "mammoth";

/**
 * File Parser Service
 * 
 * Extracts text content from various file formats:
 * - PDF (.pdf)
 * - Microsoft Word (.doc, .docx)
 * - Plain text (.txt, .md)
 */

export interface ParseResult {
  text: string;
  metadata?: {
    pages?: number;
    title?: string;
    author?: string;
  };
}

/**
 * Parse PDF file and extract text content
 */
export async function parsePDF(buffer: Buffer): Promise<ParseResult> {
  try {
    const data = await pdf(buffer);
    
    return {
      text: data.text,
      metadata: {
        pages: data.numpages,
        title: data.info?.Title,
        author: data.info?.Author,
      },
    };
  } catch (error) {
    throw new Error(
      `Failed to parse PDF: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }
}

/**
 * Parse DOCX file and extract text content
 */
export async function parseDOCX(buffer: Buffer): Promise<ParseResult> {
  try {
    const result = await mammoth.extractRawText({ buffer });
    
    if (result.messages.length > 0) {
      console.warn("DOCX parsing warnings:", result.messages);
    }
    
    return {
      text: result.value,
    };
  } catch (error) {
    throw new Error(
      `Failed to parse DOCX: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }
}

/**
 * Parse plain text file
 */
export function parseTextFile(buffer: Buffer): ParseResult {
  try {
    const text = buffer.toString("utf-8");
    return { text };
  } catch (error) {
    throw new Error(
      `Failed to parse text file: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }
}

/**
 * Parse file based on filename extension
 */
export async function parseFile(
  buffer: Buffer,
  filename: string
): Promise<ParseResult> {
  const extension = filename.toLowerCase().match(/\.([^.]+)$/)?.[1];
  
  if (!extension) {
    throw new Error("Unable to determine file type from filename");
  }
  
  switch (extension) {
    case "pdf":
      return parsePDF(buffer);
    
    case "docx":
    case "doc":
      return parseDOCX(buffer);
    
    case "txt":
    case "md":
    case "markdown":
      return parseTextFile(buffer);
    
    default:
      throw new Error(`Unsupported file type: .${extension}`);
  }
}

/**
 * Validate parsed text content
 */
export function validateParsedText(text: string, filename: string): void {
  if (!text || text.trim().length === 0) {
    throw new Error(`No text content extracted from ${filename}`);
  }
  
  if (text.length < 50) {
    throw new Error(
      `Extracted text is too short (${text.length} chars). Minimum 50 characters required.`
    );
  }
  
  if (text.length > 1_000_000) {
    throw new Error(
      `Extracted text is too long (${text.length} chars). Maximum 1,000,000 characters allowed.`
    );
  }
}

