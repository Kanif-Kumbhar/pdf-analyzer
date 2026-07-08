import zlib from "zlib";
import { promisify } from "util";

const inflateAsync = promisify(zlib.inflate);

export interface PdfMetadata {
  /** Number of pages in the document, or null if extraction failed. */
  pageCount: number | null;
  /** Approximate word count extracted from content streams, or null if extraction failed. */
  wordCount: number | null;
}

/**
 * Extracts text from a decompressed PDF content stream by parsing
 * Tj and TJ text-showing operators. Returns empty string on failure.
 *
 * Note: PDFs with custom font encodings may yield garbled characters —
 * this is still useful for counting approximate word counts.
 */
function extractTextFromStream(data: string): string {
  let text = "";

  // Unescape common PDF string escapes so word boundaries are clean
  const unescape = (s: string) =>
    s
      .replace(/\\n/g, " ")
      .replace(/\\r/g, " ")
      .replace(/\\t/g, " ")
      .replace(/\\\(/g, "(")
      .replace(/\\\)/g, ")")
      .replace(/\\\\/g, "\\");

  // (text) Tj  — show string
  // (text) '   — move to next line and show string
  const tjRe = /\(([^)\\]*(?:\\.[^)\\]*)*)\)\s*(?:Tj|'|")/g;
  let m: RegExpExecArray | null;
  while ((m = tjRe.exec(data)) !== null) {
    text += " " + unescape(m[1]);
  }

  // [(text) spacing ...] TJ  — show string with individual glyph positioning
  const tjArrRe = /\[([^\]]+)\]\s*TJ/g;
  while ((m = tjArrRe.exec(data)) !== null) {
    const innerRe = /\(([^)\\]*(?:\\.[^)\\]*)*)\)/g;
    let im: RegExpExecArray | null;
    while ((im = innerRe.exec(m[1])) !== null) {
      text += " " + unescape(im[1]);
    }
  }

  return text;
}

/**
 * Deterministically extracts page count and word count from raw PDF bytes.
 * Uses Node.js built-in zlib to decompress FlateDecode content streams.
 * All errors are swallowed — callers receive null values on failure.
 *
 * @param buffer The raw PDF file bytes.
 */
export async function extractPdfMetadata(buffer: Buffer): Promise<PdfMetadata> {
  try {
    // Represent the binary as latin1 so every byte maps 1:1 to a character.
    const raw = buffer.toString("latin1");

    // --- Page count ---
    // Count /Type /Page objects, excluding /Type /Pages (the page tree parent).
    // The negative lookahead (?!s) avoids matching /Pages.
    const pageMatches = raw.match(/\/Type\s*\/Page(?!s)/g);
    const pageCount = pageMatches ? pageMatches.length : null;

    // --- Word count via content stream decompression ---
    let extractedText = "";

    // Match each PDF object that has a stream body.
    const streamRe =
      /<<([\s\S]{1,2000}?)>>\s*stream\r?\n([\s\S]*?)\r?\nendstream/g;
    let match: RegExpExecArray | null;

    while ((match = streamRe.exec(raw)) !== null) {
      const dictStr = match[1];
      const streamBytes = match[2];

      const isFlateDecode =
        dictStr.includes("/FlateDecode") || dictStr.includes("/Fl ");

      // Skip streams that are definitely not text (images, fonts, etc.)
      const isImageStream =
        dictStr.includes("/DCTDecode") ||
        dictStr.includes("/JPXDecode") ||
        dictStr.includes("/CCITTFaxDecode") ||
        dictStr.includes("/JBIG2Decode") ||
        dictStr.includes("/Subtype /Image");

      if (isImageStream) continue;

      if (isFlateDecode) {
        try {
          const compressed = Buffer.from(streamBytes, "latin1");
          const decompressed = await inflateAsync(compressed);
          extractedText += extractTextFromStream(decompressed.toString("latin1"));
        } catch {
          // Skip streams that fail to decompress
        }
      } else {
        // Try uncompressed streams directly — many PDFs use no filter for content
        const uncompressedText = extractTextFromStream(streamBytes);
        if (uncompressedText.trim().length > 0) {
          extractedText += uncompressedText;
        }
      }
    }

    // Count words: split on whitespace, keep only tokens with ≥ 2 real characters
    const rawWordCount = extractedText.trim()
      ? extractedText
          .trim()
          .split(/\s+/)
          .filter((w) => w.replace(/[^a-zA-Z0-9]/g, "").length >= 2).length
      : null;

    // Plausibility check: if the extraction yields fewer than 200 words per page,
    // the stream text is likely garbled or incomplete (custom glyph encodings,
    // partially compressed streams, etc.). Return null to trigger the more reliable
    // page-count fallback in estimateReadingMinutes().
    const MIN_WORDS_PER_PAGE = 200;
    const wordCount =
      rawWordCount !== null &&
      pageCount !== null &&
      rawWordCount >= pageCount * MIN_WORDS_PER_PAGE
        ? rawWordCount
        : null; // null triggers page-count fallback in estimateReadingMinutes


    return { pageCount, wordCount };
  } catch {
    // Non-fatal — return nulls so the main analysis still completes.
    return { pageCount: null, wordCount: null };
  }
}
