/**
 * Extract plain text from transcript file buffers (TXT, PDF, DOCX).
 */

// Dynamic imports to avoid browser API issues in serverless environments
let pdfParse: typeof import('pdf-parse').default | null = null;
let mammothLib: typeof import('mammoth') | null = null;

async function getPDFParser() {
  if (!pdfParse) {
    // Only import in Node.js environment
    if (typeof window === 'undefined') {
      const pdfParseModule = await import('pdf-parse');
      pdfParse = pdfParseModule.default;
    } else {
      throw new Error('PDF parsing is not available in browser environment');
    }
  }
  return pdfParse;
}

async function getMammoth() {
  if (!mammothLib) {
    // Only import in Node.js environment
    if (typeof window === 'undefined') {
      mammothLib = await import('mammoth');
    } else {
      throw new Error('DOCX parsing is not available in browser environment');
    }
  }
  return mammothLib;
}

const ALLOWED_TYPES = [
  'text/plain',
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/vtt',
];
const ALLOWED_EXT = ['.txt', '.pdf', '.docx', '.doc', '.vtt'];

/**
 * Parse WebVTT transcript: strip WEBVTT header, timestamps, cue IDs, and inline tags.
 */
function parseVttTranscript(content: string): string {
  // Strip BOM (common in Windows-generated VTT files)
  const cleaned = content.replace(/^\uFEFF/, '');
  const lines = cleaned.split('\n');
  const textLines: string[] = [];
  let inBlock = false; // Track STYLE/REGION blocks

  for (const line of lines) {
    const trimmed = line.trim();

    // Skip empty lines (but end STYLE/REGION blocks)
    if (!trimmed) {
      inBlock = false;
      continue;
    }

    // Skip STYLE/REGION blocks entirely
    if (trimmed === 'STYLE' || trimmed === 'REGION') {
      inBlock = true;
      continue;
    }
    if (inBlock) continue;

    if (trimmed === 'WEBVTT' || trimmed.startsWith('WEBVTT ')) continue;
    if (trimmed.startsWith('NOTE')) continue;
    if (/^\d+$/.test(trimmed)) continue;          // Numeric cue IDs
    if (trimmed.includes('-->')) continue;          // Timestamp lines
    // Skip positioning metadata lines (line:X position:Y% size:Z% align:W)
    if (/^(line|position|size|align):/i.test(trimmed)) continue;

    // Strip inline VTT tags including <v SpeakerName>...</v> voice tags
    const stripped = trimmed.replace(/<[^>]+>/g, '').trim();
    if (stripped) textLines.push(stripped);
  }
  return textLines.join('\n');
}

export function isAllowedTranscriptFile(name: string, type?: string): boolean {
  const ext = name.slice(name.lastIndexOf('.')).toLowerCase();
  if (ALLOWED_EXT.includes(ext)) return true;
  if (type && ALLOWED_TYPES.includes(type)) return true;
  return false;
}

export async function extractTextFromTranscriptFile(
  buffer: Buffer,
  fileName: string,
  mimeType?: string
): Promise<string> {
  const ext = fileName.slice(fileName.lastIndexOf('.')).toLowerCase();
  const type = mimeType?.toLowerCase() ?? '';

  if (ext === '.txt' || type === 'text/plain') {
    return buffer.toString('utf-8');
  }

  if (ext === '.pdf' || type === 'application/pdf') {
    try {
      const PDFParser = await getPDFParser();
      if (!PDFParser) {
        throw new Error('PDF parsing is not available in this environment');
      }
      const parser = new PDFParser({ data: new Uint8Array(buffer) });
      try {
        const result = await parser.getText();
        return typeof result?.text === 'string' ? result.text : '';
      } finally {
        await parser.destroy();
      }
    } catch (pdfError) {
      // If DOMMatrix or other browser API error, provide helpful message
      if (pdfError instanceof Error && (pdfError.message.includes('DOMMatrix') || pdfError.message.includes('is not defined'))) {
        throw new Error('PDF parsing failed: Server environment issue. Please use .txt or .docx files instead.');
      }
      throw pdfError;
    }
  }

  if (ext === '.docx' || ext === '.doc' || type.includes('wordprocessingml') || type.includes('msword')) {
    try {
      const mammoth = await getMammoth();
      if (!mammoth) {
        throw new Error('DOCX parsing is not available in this environment');
      }
      const result = await mammoth.extractRawText({ buffer });
      return result?.value ?? '';
    } catch (docxError) {
      // If DOMMatrix or other browser API error, provide helpful message
      if (docxError instanceof Error && (docxError.message.includes('DOMMatrix') || docxError.message.includes('is not defined'))) {
        throw new Error('DOCX parsing failed: Server environment issue. Please use .txt files instead.');
      }
      throw docxError;
    }
  }

  if (ext === '.vtt' || type === 'text/vtt') {
    return parseVttTranscript(buffer.toString('utf-8'));
  }

  throw new Error(`Unsupported transcript file type: ${fileName}. Use .txt, .pdf, .docx, or .vtt`);
}
