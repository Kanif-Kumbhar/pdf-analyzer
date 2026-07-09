import { NextResponse } from "next/server";
import { analyzeRequestSchema } from "../../../lib/validation/analyze-request";
import { fetchPdf } from "../../../lib/pdf/fetch-pdf";
import { analyzePdfWithGemini } from "../../../lib/providers/gemini";
import { pdfAnalysisSchema } from "../../../lib/analysis/schema";
import { extractPdfMetadata } from "../../../lib/pdf/metadata";
import { estimateReadingMinutes } from "../../../lib/analysis/reading-time";
import { mapErrorToResponse } from "../../../lib/errors/error-response";
import { AppError } from "../../../lib/errors/app-error";
import { getCachedAnalysis, setCachedAnalysis, getCachedAnalysisByHash, mapUrlToAnalysis, hashFileBytes } from "../../../lib/db/analysis-cache";
import { transformUrl } from "../../../lib/url/transform-url";
import { 
  checkGeneralRateLimit, 
  reserveAnalysisQuota, 
  refundAnalysisQuota,
  getClientIp,
  hashIp
} from "../../../lib/security/rate-limit";
import { recordSearchHistory } from "../../../lib/db/search-history";
import { logger } from "../../../lib/observability/logger";

function generateRequestId(): string {
  const timestamp = Date.now();
  const randomSuffix = Math.random().toString(36).substring(2, 7);
  return `req_${timestamp}_${randomSuffix}`;
}

export async function POST(request: Request) {
  const startTime = Date.now();
  const requestId = generateRequestId();
  let quotaReserved = false;
  let geminiInvoked = false;

  logger.info({ requestId, stage: "request_received" });

  try {
    // 1. General Request Rate Limit check (protects server resources, counts cache hits)
    await checkGeneralRateLimit(request);

    // 2. Parse JSON payload
    let body: unknown;
    try {
      body = await request.clone().json();
    } catch {
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
      // Record search history for this client IP
      const ip = getClientIp(request);
      const ipHash = hashIp(ip);
      await recordSearchHistory(ipHash, pdfUrl, cacheResult.data.title);

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

    // 6. Fetch PDF (with SSRF, size limits, and signature checks)
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

    // 7. Calculate PDF content hash and check L2 (Content) cache
    const contentHash = hashFileBytes(fetchResult.data);
    const l2CacheResult = await getCachedAnalysisByHash(contentHash);

    if (l2CacheResult.hit) {
      // L2 Cache Hit — Map this URL to the existing analysis ID so future lookups hit L1
      await mapUrlToAnalysis(pdfUrl, contentHash);

      // Record in search history for client IP
      const ip = getClientIp(request);
      const ipHash = hashIp(ip);
      await recordSearchHistory(ipHash, pdfUrl, l2CacheResult.data.title);

      logger.info({
        requestId,
        stage: "cache_hit",
        durationMs: Date.now() - startTime,
        metadata: { level: "L2" },
      });
      logger.info({
        requestId,
        stage: "request_completed",
        durationMs: Date.now() - startTime,
        metadata: { cached: true, cacheLevel: "L2" },
      });
      return NextResponse.json({
        data: l2CacheResult.data,
        cached: true,
      });
    }

    // 8. Atomically reserve quota slot (only on absolute cache miss, before invoking Gemini)
    await reserveAnalysisQuota(request);
    quotaReserved = true;

    let rawAnalysis: unknown;
    let pdfMeta: Awaited<ReturnType<typeof extractPdfMetadata>>;

    try {
      geminiInvoked = true;
      [rawAnalysis, pdfMeta] = await Promise.all([
        analyzePdfWithGemini(fetchResult.data),
        extractPdfMetadata(fetchResult.data),
      ]);
    } catch (geminiError: unknown) {
      const msg = geminiError instanceof Error ? geminiError.message : "Failed to analyze the document content.";
      throw AppError.analysisFailed(msg);
    }

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
    const rawObj = rawAnalysis as Record<string, unknown> | null;
    const rawMeta = rawObj && typeof rawObj.metadata === "object" && rawObj.metadata !== null
      ? (rawObj.metadata as Record<string, unknown>)
      : null;
    const rawPageCount = rawMeta && typeof rawMeta.pageCount === "number" ? rawMeta.pageCount : 0;
    const rawReadingMinutes = rawMeta && typeof rawMeta.estimatedReadingMinutes === "number" ? rawMeta.estimatedReadingMinutes : 0;

    const analysisWithMetadata = {
      ...(rawObj || {}),
      metadata: {
        pageCount: pdfMeta.pageCount ?? rawPageCount,
        estimatedReadingMinutes: readingMinutes ?? rawReadingMinutes,
        analyzedAt: new Date().toISOString(),
      },
    };

    const finalValidation = pdfAnalysisSchema.safeParse(analysisWithMetadata);
    if (!finalValidation.success) {
      console.error("Schema validation failed for model output:", finalValidation.error.format());
      throw AppError.internal("The analysis model generated data that does not conform to the expected schema.");
    }

    // 10. Store result in both L1 and L2 cache
    await setCachedAnalysis(pdfUrl, contentHash, finalValidation.data);

    // Record search history for this client IP
    const ip = getClientIp(request);
    const ipHash = hashIp(ip);
    await recordSearchHistory(ipHash, pdfUrl, finalValidation.data.title);

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
    if (quotaReserved && !geminiInvoked) {
      try {
        await refundAnalysisQuota(request);
      } catch (refundErr) {
        console.error("[Refund] Failed to refund reserved quota:", refundErr);
      }
    }

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

