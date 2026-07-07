import { NextResponse } from "next/server";
import { analyzeRequestSchema } from "../../../lib/validation/analyze-request";
import { fetchPdf } from "../../../lib/pdf/fetch-pdf";
import { analyzePdfWithGemini } from "../../../lib/providers/gemini";
import { pdfAnalysisSchema } from "../../../lib/analysis/schema";


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
    let fetchResult;
    try {
      fetchResult = await fetchPdf(pdfUrl);
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

    // 4. Analyze PDF with Gemini
    let rawAnalysis;
    try {
      rawAnalysis = await analyzePdfWithGemini(fetchResult.data);
    } catch (geminiError: any) {
      return NextResponse.json(
        {
          error: {
            code: "ANALYSIS_FAILED",
            message: geminiError.message || "Failed to analyze the document content.",
            requestId,
          },
        },
        { status: 502 } // Bad Gateway from Gemini API
      );
    }

    // 5. Inject server-side metadata and validate structure
    const analysisWithMetadata = {
      ...rawAnalysis,
      metadata: {
        ...rawAnalysis?.metadata,
        analyzedAt: new Date().toISOString(),
      },
    };

    const finalValidation = pdfAnalysisSchema.safeParse(analysisWithMetadata);
    if (!finalValidation.success) {
      console.error("Zod output validation failed:", finalValidation.error.format());
      return NextResponse.json(
        {
          error: {
            code: "INVALID_OUTPUT",
            message: "The analysis model generated data that does not conform to the expected schema.",
            requestId,
          },
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      data: finalValidation.data,
    });
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
