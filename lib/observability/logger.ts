export type LogStage =
  | "request_received"
  | "validation_completed"
  | "cache_hit"
  | "cache_miss"
  | "pdf_fetch_started"
  | "pdf_fetch_completed"
  | "analysis_started"
  | "analysis_completed"
  | "request_completed"
  | "request_failed"
  // upload-specific stages
  | "upload_request_received"
  | "upload_validated"
  | "upload_cache_hit"
  | "upload_cache_miss"
  | "upload_analysis_completed"
  | "upload_request_completed"
  | "upload_request_failed";

interface LogPayload {
  requestId: string;
  stage: LogStage;
  durationMs?: number;
  errorCode?: string;
  metadata?: Record<string, unknown>;
}

// Structured Logger for standardized stdout execution logs without exposing secrets.
export const logger = {
  info(payload: LogPayload) {
    const output = {
      timestamp: new Date().toISOString(),
      level: "INFO",
      ...payload,
    };
    console.log(JSON.stringify(output));
  },

  error(payload: LogPayload & { message?: string; stack?: string }) {
    const output = {
      timestamp: new Date().toISOString(),
      level: "ERROR",
      ...payload,
    };
    console.error(JSON.stringify(output));
  },
};
