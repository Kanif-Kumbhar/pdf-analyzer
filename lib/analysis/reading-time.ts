/**
 * Average adult silent reading speed in words per minute.
 * Source: Brysbaert, M. (2019). "How many words do we read per minute?
 *         A review and meta-analysis of reading rate." — median: 238 wpm.
 */
const WORDS_PER_MINUTE = 238;

/**
 * Average word density per page across common document types.
 * Used as a fallback when direct word count extraction is unavailable.
 * (Academic papers ~300, books ~250, technical docs ~200 — 250 is a safe median.)
 */
const AVERAGE_WORDS_PER_PAGE = 250;

/**
 * Estimates the reading time for a document in whole minutes.
 * Tries word count first; falls back to page-count-based estimation
 * when text extraction from compressed streams is unavailable.
 *
 * @param wordCount Words extracted from content streams, or null.
 * @param pageCount Page count from raw PDF structure, or null.
 * @returns Estimated reading time in minutes (minimum 1), or null if
 *          neither metric is available.
 */
export function estimateReadingMinutes(
  wordCount: number | null,
  pageCount: number | null
): number | null {
  if (wordCount !== null && wordCount > 0) {
    // Primary: use actual extracted word count
    return Math.max(1, Math.round(wordCount / WORDS_PER_MINUTE));
  }
  if (pageCount !== null && pageCount > 0) {
    // Fallback: estimate words from page count using average word density
    const estimatedWords = pageCount * AVERAGE_WORDS_PER_PAGE;
    return Math.max(1, Math.round(estimatedWords / WORDS_PER_MINUTE));
  }
  return null;
}
