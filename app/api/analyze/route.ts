import { NextResponse } from "next/server";
import { analyzeRequestSchema } from "../../../lib/validation/analyze-request";
import { fetchPdf } from "../../../lib/pdf/fetch-pdf";
import { analyzePdfWithGemini } from "../../../lib/providers/gemini";
import { pdfAnalysisSchema } from "../../../lib/analysis/schema";
import { mapErrorToResponse } from "../../../lib/errors/error-response";
import { AppError } from "../../../lib/errors/app-error";

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
    // 1. Parse JSON payload
    let body: any;
    try {
      body = await request.json();
    } catch (err) {
      throw AppError.invalidRequest("Malformed JSON payload in request body.");
    }

    // 2. Validate URL against request schema
    const validationResult = analyzeRequestSchema.safeParse(body);
    if (!validationResult.success) {
      throw validationResult.error; // Throws ZodError to be caught and mapped centrally
    }

    const { pdfUrl } = validationResult.data;

    // 3. Fetch PDF (with SSRF, size limits, and signature checks)
    const fetchResult = await fetchPdf(pdfUrl);

    // 4. Analyze PDF content with Gemini structured output
    let rawAnalysis: any;
    try {
      rawAnalysis = await analyzePdfWithGemini(fetchResult.data);
    } catch (geminiError: any) {
      throw AppError.analysisFailed(geminiError.message || "Failed to analyze the document content.");
    }

    // 5. Inject server-side metadata and validate target schema
    const analysisWithMetadata = {
      ...rawAnalysis,
      metadata: {
        ...rawAnalysis?.metadata,
        analyzedAt: new Date().toISOString(),
      },
    };

    const finalValidation = pdfAnalysisSchema.safeParse(analysisWithMetadata);
    if (!finalValidation.success) {
      console.error("Schema validation failed for model output:", finalValidation.error.format());
      throw AppError.internal("The analysis model generated data that does not conform to the expected schema.");
    }

    // 6. Return successful response
    return NextResponse.json({
      data: finalValidation.data,
    });
  } catch (error) {
    // 7. Route all errors to centralized mapper
    return mapErrorToResponse(error, requestId);
  }
}
