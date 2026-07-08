import { NextResponse } from "next/server";
import { analyzeRequestSchema } from "../../../lib/validation/analyze-request";
import { fetchPdf } from "../../../lib/pdf/fetch-pdf";
import { analyzePdfWithGemini } from "../../../lib/providers/gemini";
import { pdfAnalysisSchema } from "../../../lib/analysis/schema";
import { mapErrorToResponse } from "../../../lib/errors/error-response";
import { AppError } from "../../../lib/errors/app-error";
import { getCachedAnalysis, setCachedAnalysis } from "../../../lib/db/analysis-cache";
import { transformUrl } from "../../../lib/url/transform-url";

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
      throw validationResult.error;
    }

    const { pdfUrl: rawPdfUrl } = validationResult.data;

    // 3. Normalize known share/viewer URLs (e.g. Google Drive) to direct download URLs
    const { url: pdfUrl, transformed, source } = transformUrl(rawPdfUrl);
    if (transformed) {
      console.log(`[URL] Transformed ${source} link for direct download.`);
    }

    // 4. Cache lookup — skip Gemini on a hit
    const cacheResult = await getCachedAnalysis(pdfUrl);
    if (cacheResult.hit) {
      return NextResponse.json({
        data: cacheResult.data,
        cached: true,
      });
    }

    // 5. Fetch PDF (with SSRF, size limits, and signature checks)
    const fetchResult = await fetchPdf(pdfUrl);

    // 6. Analyze PDF content with Gemini structured output
    let rawAnalysis: any;
    try {
      rawAnalysis = await analyzePdfWithGemini(fetchResult.data);
    } catch (geminiError: any) {
      throw AppError.analysisFailed(geminiError.message || "Failed to analyze the document content.");
    }

    // 7. Inject server-side metadata and validate target schema
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

    // 8. Store result in cache — awaited to ensure response stream is flushed correctly
    await setCachedAnalysis(pdfUrl, finalValidation.data);

    // 8. Return fresh response
    return NextResponse.json({
      data: finalValidation.data,
      cached: false,
    });
  } catch (error) {
    return mapErrorToResponse(error, requestId);
  }
}
