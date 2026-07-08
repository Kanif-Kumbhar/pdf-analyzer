import { NextResponse } from "next/server";
import { analyzeRequestSchema } from "../../../lib/validation/analyze-request";
import { fetchPdf } from "../../../lib/pdf/fetch-pdf";
import { analyzePdfWithGemini } from "../../../lib/providers/gemini";
import { pdfAnalysisSchema } from "../../../lib/analysis/schema";
import { extractPdfMetadata } from "../../../lib/pdf/metadata";
import { estimateReadingMinutes } from "../../../lib/analysis/reading-time";
import { mapErrorToResponse } from "../../../lib/errors/error-response";
import { AppError } from "../../../lib/errors/app-error";
import { getCachedAnalysis, setCachedAnalysis } from "../../../lib/db/analysis-cache";
import { transformUrl } from "../../../lib/url/transform-url";
import { 
  checkGeneralRateLimit, 
  checkAnalysisRateLimit, 
  consumeAnalysisQuota 
} from "../../../lib/security/rate-limit";
import { logger } from "../../../lib/observability/logger";

function generateRequestId(): string {
  const timestamp = Date.now();
  const randomSuffix = Math.random().toString(36).substring(2, 7);
  return `req_${timestamp}_${randomSuffix}`;
}

export async function POST(request: Request) {
  const startTime = Date.now();
  const requestId = generateRequestId();

  logger.info({ requestId, stage: "request_received" });

  try {
    // 1. General Request Rate Limit check (protects server resources, counts cache hits)
    await checkGeneralRateLimit(request);

    // 2. Parse JSON payload
    let body: any;
    try {
      body = await request.clone().json(); // clone so it can be re-read if needed, though not needed here
    } catch (err) {
      throw AppError.invalidRequest("Malformed JSON payload in request body.");
    }

    // 3. Validate URL against request schema
    const validationResult = analyzeRequestSchema.safeParse(body);
    if (!validationResult.success) {
      throw validationResult.error;
    }

    const { pdfUrl: rawPdfUrl } = validationResult.data;
    logger.info({
      requestId,
      stage: "validation_completed",
      durationMs: Date.now() - startTime,
    });

    // 4. Normalize known share/viewer URLs (e.g. Google Drive) to direct download URLs
    const { url: pdfUrl, transformed, source } = transformUrl(rawPdfUrl);
    if (transformed) {
      console.log(`[URL] Transformed ${source} link for direct download.`);
    }

    // 5. Cache lookup — skip Gemini on a hit
    const cacheResult = await getCachedAnalysis(pdfUrl);
    if (cacheResult.hit) {
      logger.info({
        requestId,
        stage: "cache_hit",
        durationMs: Date.now() - startTime,
      });
      logger.info({
        requestId,
        stage: "request_completed",
        durationMs: Date.now() - startTime,
        metadata: { cached: true },
      });
      return NextResponse.json({
        data: cacheResult.data,
        cached: true,
      });
    }

    logger.info({
      requestId,
      stage: "cache_miss",
      durationMs: Date.now() - startTime,
    });

    // 6. Check Analysis limit quota BEFORE fetching or analyzing (prevents unnecessary fetching if blocked)
    await checkAnalysisRateLimit(request);

    // 7. Fetch PDF (with SSRF, size limits, and signature checks)
    logger.info({
      requestId,
      stage: "pdf_fetch_started",
      durationMs: Date.now() - startTime,
    });
    const fetchResult = await fetchPdf(pdfUrl, 30000);
    logger.info({
      requestId,
      stage: "pdf_fetch_completed",
      durationMs: Date.now() - startTime,
      metadata: { byteSize: fetchResult.size },
    });

    let rawAnalysis: any;
    let pdfMeta: Awaited<ReturnType<typeof extractPdfMetadata>>;

    try {
      [rawAnalysis, pdfMeta] = await Promise.all([
        analyzePdfWithGemini(fetchResult.data),
        extractPdfMetadata(fetchResult.data),
      ]);
    } catch (geminiError: any) {
      throw AppError.analysisFailed(geminiError.message || "Failed to analyze the document content.");
    }

    // Consume the analysis quota only after Gemini successfully completes
    await consumeAnalysisQuota(request);

    const readingMinutes = estimateReadingMinutes(pdfMeta.wordCount, pdfMeta.pageCount);

    logger.info({
      requestId,
      stage: "analysis_completed",
      durationMs: Date.now() - startTime,
      metadata: {
        pageCount: pdfMeta.pageCount,
        wordCount: pdfMeta.wordCount,
        readingMinutes,
      },
    });

    // 9. Merge deterministic metadata over Gemini's output, then validate schema
    const analysisWithMetadata = {
      ...rawAnalysis,
      metadata: {
        pageCount: pdfMeta.pageCount ?? rawAnalysis?.metadata?.pageCount ?? 0,
        estimatedReadingMinutes: readingMinutes ?? rawAnalysis?.metadata?.estimatedReadingMinutes ?? 0,
        analyzedAt: new Date().toISOString(),
      },
    };

    const finalValidation = pdfAnalysisSchema.safeParse(analysisWithMetadata);
    if (!finalValidation.success) {
      console.error("Schema validation failed for model output:", finalValidation.error.format());
      throw AppError.internal("The analysis model generated data that does not conform to the expected schema.");
    }

    // 10. Store result in cache
    await setCachedAnalysis(pdfUrl, finalValidation.data);

    logger.info({
      requestId,
      stage: "request_completed",
      durationMs: Date.now() - startTime,
      metadata: { cached: false },
    });

    return NextResponse.json({
      data: finalValidation.data,
      cached: false,
    });
  } catch (error) {
    let errorCode = "INTERNAL_ERROR";
    if (error instanceof AppError) {
      errorCode = error.code;
    } else if (error && typeof error === "object" && "name" in error && error.name === "ZodError") {
      errorCode = "INVALID_URL";
    }

    logger.error({
      requestId,
      stage: "request_failed",
      durationMs: Date.now() - startTime,
      errorCode,
      message: error instanceof Error ? error.message : String(error),
    });

    return mapErrorToResponse(error, requestId);
  }
}

