/**
 * Transforms known file-hosting share/viewer URLs into direct downloadable URLs.
 * This runs before SSRF checks, cache lookup, and fetch — so all downstream
 * logic always sees a clean, fetchable URL.
 *
 * Currently supported transformations:
 *   - Google Drive viewer/share → direct download
 */

/**
 * Google Drive viewer/share URL pattern.
 * Matches:
 *   https://drive.google.com/file/d/FILE_ID/view
 *   https://drive.google.com/file/d/FILE_ID/view?usp=sharing
 *   https://drive.google.com/file/d/FILE_ID/view?usp=drive_link
 *   https://drive.google.com/open?id=FILE_ID
 */
const GOOGLE_DRIVE_FILE_PATTERN = /drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/;
const GOOGLE_DRIVE_OPEN_PATTERN = /drive\.google\.com\/open\?id=([a-zA-Z0-9_-]+)/;

function transformGoogleDriveUrl(url: string): string | null {
  // Pattern: /file/d/FILE_ID/...
  const fileMatch = url.match(GOOGLE_DRIVE_FILE_PATTERN);
  if (fileMatch) {
    const fileId = fileMatch[1];
    return `https://drive.google.com/uc?export=download&id=${fileId}`;
  }

  // Pattern: /open?id=FILE_ID
  const openMatch = url.match(GOOGLE_DRIVE_OPEN_PATTERN);
  if (openMatch) {
    const fileId = openMatch[1];
    return `https://drive.google.com/uc?export=download&id=${fileId}`;
  }

  return null;
}

/**
 * Attempts to transform a user-supplied URL into a directly fetchable PDF URL.
 * Returns the transformed URL if a known pattern was matched, or the original URL unchanged.
 *
 * @param url The raw URL provided by the user (already passed schema validation).
 * @returns A tuple of [finalUrl, wasTransformed].
 */
export function transformUrl(url: string): { url: string; transformed: boolean; source?: string } {
  const googleDrive = transformGoogleDriveUrl(url);
  if (googleDrive) {
    console.log(`[URL] Normalized Google Drive link: ${url} → ${googleDrive}`);
    return { url: googleDrive, transformed: true, source: "google-drive" };
  }

  return { url, transformed: false };
}
