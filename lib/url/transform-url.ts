// Transform share/viewer URLs (e.g., Google Drive) into direct download links before validation/fetch.

// Google Drive viewer/share URL patterns: /file/d/FILE_ID/... or /open?id=FILE_ID
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

// Transform user URL to direct fetchable URL if it matches a known hosting pattern.
export function transformUrl(url: string): { url: string; transformed: boolean; source?: string } {
  const googleDrive = transformGoogleDriveUrl(url);
  if (googleDrive) {
    console.log(`[URL] Normalized Google Drive link: ${url} → ${googleDrive}`);
    return { url: googleDrive, transformed: true, source: "google-drive" };
  }

  return { url, transformed: false };
}
