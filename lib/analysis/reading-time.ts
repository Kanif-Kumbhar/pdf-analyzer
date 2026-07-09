// Average reading speed for technical/academic documents (180 words per minute).
const WORDS_PER_MINUTE = 180;

// Average word density per page for academic/technical documents (350 words).
const AVERAGE_WORDS_PER_PAGE = 350;

// Minimum words-per-page threshold to verify text extraction reliability.
const MIN_WORDS_PER_PAGE = 200;

// Estimate reading time in minutes (minimum 1) using word count or page-count fallback.
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
