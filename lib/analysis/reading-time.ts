/**
 * Effective reading speed for technical and academic documents in words per minute.
 *
 * Brysbaert (2019) reports a median of ~238 wpm across all reading material, but
 * that figure is skewed toward fiction and narrative text. For dense academic and
 * technical content — equations, citations, multi-column layouts, figures — the
 * comprehension reading rate is typically 100–180 wpm.
 * Source: Carver (1990) "Reading Rate: A Review of Research and Theory", p. 84–96.
 *
 * Using 180 wpm as a conservative but realistic upper bound for this use case,
 * where users are expected to actually understand the document, not skim it.
 */
const WORDS_PER_MINUTE = 180;

/**
 * Average word density per page for the documents this tool typically handles.
 * Academic papers, research reports, and technical docs average 350–450 words
 * per page (including space for figures, equations, and reference lists).
 * 350 is used as a conservative estimate.
 */
const AVERAGE_WORDS_PER_PAGE = 350;

/**
 * Minimum plausible words-per-page for a complete extraction.
 * If the extracted word count falls below this threshold × page count,
 * the text extraction likely missed significant content (custom glyph
 * encodings, partially compressed streams, etc.) and the page-count
 * fallback is more reliable.
 */
const MIN_WORDS_PER_PAGE = 200;

/**
 * Estimates the reading time for a document in whole minutes.
 * Tries word count first; falls back to page-count-based estimation
 * when text extraction from compressed streams is unavailable or
 * yields an implausibly low word count.
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
  // Use extracted word count only if it clears the plausibility threshold
  if (
    wordCount !== null &&
    wordCount > 0 &&
    (pageCount === null || wordCount >= pageCount * MIN_WORDS_PER_PAGE)
  ) {
    return Math.max(1, Math.round(wordCount / WORDS_PER_MINUTE));
  }
  if (pageCount !== null && pageCount > 0) {
    // Fallback: estimate from page count using average word density
    const estimatedWords = pageCount * AVERAGE_WORDS_PER_PAGE;
    return Math.max(1, Math.round(estimatedWords / WORDS_PER_MINUTE));
  }
  return null;
}
