import { NextResponse } from "next/server";
import { analyzeRequestSchema } from "../../../lib/validation/analyze-request";
import { fetchPdf } from "../../../lib/pdf/fetch-pdf";

/**
 * Helper to generate a unique request ID for tracing.
 */
function generateRequestId(): string {
  const timestamp = Date.now();
  const randomSuffix = Math.random().toString(36).substring(2, 7);
  return `req_${timestamp}_${randomSuffix}`;
}

export async function POST(request: Request) {
  const requestId = generateRequestId();

  try {
    // 1. Validate that the payload is JSON
    let body: any;
    try {
      body = await request.json();
    } catch (err) {
      return NextResponse.json(
        {
          error: {
            code: "INVALID_REQUEST",
            message: "Malformed JSON payload in request body.",
            requestId,
          },
        },
        { status: 400 }
      );
    }

    // 2. Validate URL against Zod request schema
    const validationResult = analyzeRequestSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: {
            code: "INVALID_URL",
            message: validationResult.error.issues[0]?.message || "Please enter a valid HTTP or HTTPS URL.",
            requestId,
          },
        },
        { status: 400 }
      );
    }

    const { pdfUrl } = validationResult.data;

    // 3. Fetch PDF and validate content type & HTTP status
    try {
      const fetchResult = await fetchPdf(pdfUrl);
      
      // 4. Return temporary success response containing size
      return NextResponse.json({
        success: true,
        size: fetchResult.size,
      });
    } catch (fetchError: any) {
      return NextResponse.json(
        {
          error: {
            code: "FETCH_FAILED",
            message: fetchError.message || "Failed to retrieve the PDF document.",
            requestId,
          },
        },
        { status: 400 } // Bad request for invalid target document/status
      );
    }
  } catch (globalError: any) {
    return NextResponse.json(
      {
        error: {
          code: "INTERNAL_ERROR",
          message: globalError.message || "An unexpected error occurred on the server.",
          requestId,
        },
      },
      { status: 500 }
    );
  }
}
