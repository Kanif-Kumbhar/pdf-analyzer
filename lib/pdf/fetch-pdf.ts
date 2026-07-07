import { validateUrl } from "../security/validate-url";

export interface FetchPdfResult {
  data: Buffer;
  size: number;
}

/**
 * Fetches a PDF file from a given URL with SSRF protections.
 * Performs URL parsing, protocol check, DNS validation, and manual redirect loop checks.
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
          throw new Error("Too many redirects (limit is 5).");
        }

        const location = response.headers.get("location");
        if (!location) {
          throw new Error(`Redirect response (${status}) is missing its Location header.`);
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

    if (!response.ok) {
      throw new Error(`Failed to fetch PDF (HTTP status ${response.status})`);
    }

    const contentType = response.headers.get("content-type") || "";
    if (!contentType.toLowerCase().includes("application/pdf")) {
      throw new Error("Invalid content type. The URL must point to a PDF file.");
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    return {
      data: buffer,
      size: buffer.byteLength,
    };
  } catch (error: any) {
    clearTimeout(id);
    if (error.name === "AbortError") {
      throw new Error("Request timed out while fetching the PDF document.");
    }
    throw error;
  }
}
