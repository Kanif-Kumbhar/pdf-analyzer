import { validateUrl } from "../security/validate-url";
import { AppError } from "../errors/app-error";

export interface FetchPdfResult {
  data: Buffer;
  size: number;
}

/**
 * Fetches a PDF file from a given URL with SSRF protections.
 * Performs URL parsing, protocol check, DNS validation, manual redirect loop checks,
 * content size restrictions, and PDF format verification.
 *
 * @param url The public HTTP or HTTPS URL pointing to the PDF document.
 * @param timeoutMs Request timeout limit in milliseconds. Defaults to 10 seconds.
 */
export async function fetchPdf(url: string, timeoutMs: number = 10000): Promise<FetchPdfResult> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);

  try {
    let currentUrl = await validateUrl(url);
    let redirectCount = 0;
    const maxRedirects = 5;
    let response: Response;

    while (true) {
      response = await fetch(currentUrl.toString(), {
        signal: controller.signal,
        redirect: "manual", // Disable automatic redirects to intercept and validate targets
        headers: {
          "User-Agent": "PDF-Analyzer-Bot/1.0",
        },
      });

      const status = response.status;
      
      // Handle redirects manually
      if ([301, 302, 303, 307, 308].includes(status)) {
        redirectCount++;
        if (redirectCount > maxRedirects) {
          throw AppError.invalidRequest("Too many redirects (limit is 5).");
        }

        const location = response.headers.get("location");
        if (!location) {
          throw AppError.invalidRequest(`Redirect response (${status}) is missing its Location header.`);
        }

        // Resolve relative redirects against the current URL
        const nextUrl = new URL(location, currentUrl);

        // Revalidate the redirect destination URL against security policies
        currentUrl = await validateUrl(nextUrl.toString());
        continue;
      }

      break;
    }

    clearTimeout(id);

    // Validate response HTTP status
    if (!response.ok) {
      if (response.status === 404) {
        throw AppError.pdfNotFound("Failed to fetch PDF (HTTP status 404).");
      }
      if (response.status === 401 || response.status === 403) {
        throw AppError.pdfInaccessible(`Failed to fetch PDF (HTTP status ${response.status}). Permission denied.`);
      }
      throw AppError.pdfInaccessible(`Failed to fetch PDF (HTTP status ${response.status}).`);
    }

    // Check Content-Type header
    const contentType = response.headers.get("content-type") || "";
    if (!contentType.toLowerCase().includes("application/pdf")) {
      throw AppError.invalidPdf("Invalid content type. The URL must point to a PDF file.");
    }

    // Determine the max file size limit (default to 10MB)
    const maxFileSizeEnv = process.env.MAX_FILE_SIZE;
    const maxFileSize = maxFileSizeEnv ? parseInt(maxFileSizeEnv, 10) : 10 * 1024 * 1024;

    // Content-Length pre-check
    const contentLengthHeader = response.headers.get("content-length");
    if (contentLengthHeader) {
      const contentLength = parseInt(contentLengthHeader, 10);
      if (!isNaN(contentLength) && contentLength > maxFileSize) {
        throw AppError.pdfTooLarge("File size limit exceeded (maximum is 10MB).");
      }
    }

    // Stream the body chunks and count actual bytes received
    if (!response.body) {
      throw AppError.invalidPdf("Response body is empty or unavailable.");
    }

    const chunks: Uint8Array[] = [];
    let totalBytes = 0;
    let checkedSignature = false;

    // Read the stream chunk by chunk
    for await (const chunk of response.body as any) {
      totalBytes += chunk.byteLength;
      if (totalBytes > maxFileSize) {
        throw AppError.pdfTooLarge("File size limit exceeded (maximum is 10MB).");
      }

      chunks.push(chunk);

      // Verify PDF signature (%PDF-) in the first few bytes
      if (!checkedSignature && totalBytes >= 5) {
        const headerBuffer = Buffer.concat(chunks.map((c) => Buffer.from(c)), 5);
        const signature = headerBuffer.toString("ascii", 0, 5);
        if (signature !== "%PDF-") {
          throw AppError.invalidPdf("Invalid PDF signature. The file is not a valid PDF document.");
        }
        checkedSignature = true;
      }
    }

    // Final check for tiny files that finished streaming without triggering signature check
    if (!checkedSignature) {
      const completeBuffer = Buffer.concat(chunks.map((c) => Buffer.from(c)));
      if (completeBuffer.length < 5 || completeBuffer.toString("ascii", 0, 5) !== "%PDF-") {
        throw AppError.invalidPdf("Invalid PDF signature. The file is not a valid PDF document.");
      }
    }

    // Concatenate all chunks into the final Buffer
    const buffer = Buffer.concat(chunks.map((c) => Buffer.from(c)));

    return {
      data: buffer,
      size: buffer.byteLength,
    };
  } catch (error: any) {
    clearTimeout(id);
    if (error.name === "AbortError") {
      throw AppError.pdfFetchTimeout("Request timed out while fetching the PDF document.");
    }
    throw error;
  }
}
