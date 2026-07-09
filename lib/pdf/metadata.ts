import zlib from "zlib";
import { promisify } from "util";

const inflateAsync = promisify(zlib.inflate);

export interface PdfMetadata {
  pageCount: number | null; // Number of pages in the document (null if failed)
  wordCount: number | null; // Approximate word count from content streams (null if failed)
}

function extractTextFromStream(data: string): string {
  let text = "";

  const unescape = (s: string) =>
    s
      .replace(/\\n/g, " ")
      .replace(/\\r/g, " ")
      .replace(/\\t/g, " ")
      .replace(/\\\(/g, "(")
      .replace(/\\\)/g, ")")
      .replace(/\\\\/g, "\\");

  const tjRe = /\(([^)\\]*(?:\\.[^)\\]*)*)\)\s*(?:Tj|'|")/g;
  let m: RegExpExecArray | null;
  while ((m = tjRe.exec(data)) !== null) {
    text += " " + unescape(m[1]);
  }

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

// Extract page count and word count from raw PDF bytes using built-in zlib.
export async function extractPdfMetadata(buffer: Buffer): Promise<PdfMetadata> {
  try {
    // Represent the binary as latin1 so every byte maps 1:1 to a character.
    const raw = buffer.toString("latin1");

    const pageMatches = raw.match(/\/Type\s*\/Page(?!s)/g);
    const pageCount = pageMatches ? pageMatches.length : null;

    let extractedText = "";

    const streamRe =
      /<<([\s\S]{1,2000}?)>>\s*stream\r?\n([\s\S]*?)\r?\nendstream/g;
    let match: RegExpExecArray | null;

    while ((match = streamRe.exec(raw)) !== null) {
      const dictStr = match[1];
      const streamBytes = match[2];

      const isFlateDecode =
        dictStr.includes("/FlateDecode") || dictStr.includes("/Fl ");

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
        const uncompressedText = extractTextFromStream(streamBytes);
        if (uncompressedText.trim().length > 0) {
          extractedText += uncompressedText;
        }
      }
    }

    const rawWordCount = extractedText.trim()
      ? extractedText
          .trim()
          .split(/\s+/)
          .filter((w) => w.replace(/[^a-zA-Z0-9]/g, "").length >= 2).length
      : null;

    const MIN_WORDS_PER_PAGE = 200;
    const wordCount =
      rawWordCount !== null &&
      pageCount !== null &&
      rawWordCount >= pageCount * MIN_WORDS_PER_PAGE
        ? rawWordCount
        : null;


    return { pageCount, wordCount };
  } catch {
    return { pageCount: null, wordCount: null };
  }
}
