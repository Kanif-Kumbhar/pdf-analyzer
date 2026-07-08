import { NextResponse } from "next/server";
import { analyzePdfWithGemini } from "../../../../lib/providers/gemini";
import { pdfAnalysisSchema } from "../../../../lib/analysis/schema";
import { extractPdfMetadata } from "../../../../lib/pdf/metadata";
import { estimateReadingMinutes } from "../../../../lib/analysis/reading-time";
import { mapErrorToResponse } from "../../../../lib/errors/error-response";
import { AppError } from "../../../../lib/errors/app-error";
import {
  getCachedAnalysisByHash,
  setCachedAnalysisByHash,
  hashFileBytes,
} from "../../../../lib/db/analysis-cache";
import {
  checkGeneralRateLimit,
  reserveAnalysisQuota,
  refundAnalysisQuota,
  getClientIp,
  hashIp,
} from "../../../../lib/security/rate-limit";
import { recordSearchHistory } from "../../../../lib/db/search-history";
import { validateUploadedPdf } from "../../../../lib/pdf/validate-upload";
import { logger } from "../../../../lib/observability/logger";

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

  logger.info({ requestId, stage: "upload_request_received" });

  try {
    // 1. General request rate limit (same as URL flow)
    await checkGeneralRateLimit(request);

    // 2. Parse and validate the uploaded file
    const { data: pdfBuffer, filename, size } = await validateUploadedPdf(request);

    logger.info({
      requestId,
      stage: "upload_validated",
      durationMs: Date.now() - startTime,
      metadata: { filename, byteSize: size },
    });

    // 3. Content-addressed cache lookup using SHA-256 of the raw bytes
    const contentHash = hashFileBytes(pdfBuffer);
    const cacheResult = await getCachedAnalysisByHash(contentHash);

    if (cacheResult.hit) {
      // Record in history using the synthetic URL so it shows in the history panel
      const ip = getClientIp(request);
      const ipHash = hashIp(ip);
      await recordSearchHistory(ipHash, `upload::${contentHash}`, cacheResult.data.title);

      logger.info({
        requestId,
        stage: "upload_cache_hit",
        durationMs: Date.now() - startTime,
      });

      return NextResponse.json({ data: cacheResult.data, cached: true, filename });
    }

    logger.info({ requestId, stage: "upload_cache_miss", durationMs: Date.now() - startTime });

    // 4. Atomically reserve AI quota slot before calling Gemini
    await reserveAnalysisQuota(request);
    quotaReserved = true;

    // 5. Gemini + metadata extraction in parallel (same as URL flow)
    let rawAnalysis: any;
    let pdfMeta: Awaited<ReturnType<typeof extractPdfMetadata>>;

    try {
      geminiInvoked = true;
      [rawAnalysis, pdfMeta] = await Promise.all([
        analyzePdfWithGemini(pdfBuffer),
        extractPdfMetadata(pdfBuffer),
      ]);
    } catch (geminiError: any) {
      throw AppError.analysisFailed(
        geminiError.message || "Failed to analyze the document content."
      );
    }

    const readingMinutes = estimateReadingMinutes(pdfMeta.wordCount, pdfMeta.pageCount);

    logger.info({
      requestId,
      stage: "upload_analysis_completed",
      durationMs: Date.now() - startTime,
      metadata: { filename, pageCount: pdfMeta.pageCount, readingMinutes },
    });

    // 6. Validate Gemini output with Zod schema
    const analysisWithMetadata = {
      ...rawAnalysis,
      metadata: {
        pageCount: pdfMeta.pageCount ?? rawAnalysis?.metadata?.pageCount ?? 0,
        estimatedReadingMinutes:
          readingMinutes ?? rawAnalysis?.metadata?.estimatedReadingMinutes ?? 0,
        analyzedAt: new Date().toISOString(),
      },
    };

    const finalValidation = pdfAnalysisSchema.safeParse(analysisWithMetadata);
    if (!finalValidation.success) {
      console.error(
        "Schema validation failed for upload model output:",
        finalValidation.error.format()
      );
      throw AppError.internal(
        "The analysis model generated data that does not conform to the expected schema."
      );
    }

    // 7. Cache result by content hash
    await setCachedAnalysisByHash(contentHash, filename, finalValidation.data);

    // 8. Record in search history using filename as the display title
    const ip = getClientIp(request);
    const ipHash = hashIp(ip);
    await recordSearchHistory(ipHash, `upload::${contentHash}`, finalValidation.data.title);

    logger.info({
      requestId,
      stage: "upload_request_completed",
      durationMs: Date.now() - startTime,
      metadata: { cached: false },
    });

    return NextResponse.json({
      data: finalValidation.data,
      cached: false,
      filename,
    });
  } catch (error) {
    // Refund quota if Gemini was never actually called
    if (quotaReserved && !geminiInvoked) {
      try {
        await refundAnalysisQuota(request);
      } catch (refundErr) {
        console.error("[Refund] Failed to refund upload quota:", refundErr);
      }
    }

    let errorCode = "INTERNAL_ERROR";
    if (error instanceof AppError) {
      errorCode = error.code;
    }

    logger.error({
      requestId,
      stage: "upload_request_failed",
      durationMs: Date.now() - startTime,
      errorCode,
      message: error instanceof Error ? error.message : String(error),
    });

    return mapErrorToResponse(error, requestId);
  }
}
