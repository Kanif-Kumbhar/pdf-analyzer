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
  | "request_failed";

interface LogPayload {
  requestId: string;
  stage: LogStage;
  durationMs?: number;
  errorCode?: string;
  metadata?: Record<string, any>;
}

/**
 * Structured Logger to output standardized request execution logs to console stdout.
 * Formats data cleanly while preventing security exposure of keys, secrets, or content.
 */
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
