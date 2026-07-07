import { NextResponse } from "next/server";
import { AppError } from "./app-error";
import { ZodError } from "zod";

/**
 * Centrally maps errors (AppError, ZodError, or generic Error) to formatted JSON NextResponses.
 * Logs error details and stack trace to the server logs for diagnostics.
 *
 * @param error The thrown error object.
 * @param requestId Unique identifier for request tracing.
 * @returns NextResponse formatted to client specifications.
 */
export function mapErrorToResponse(error: unknown, requestId: string): NextResponse {
  // Log detailed error diagnostics on the server
  console.error(`[ERROR] RequestId: ${requestId}`);
  if (error instanceof Error) {
    console.error(`Code/Name: ${error.name === "AppError" ? (error as AppError).code : error.name}`);
    console.error(`Message: ${error.message}`);
    if (error.stack) {
      console.error(error.stack);
    }
  } else {
    console.error(`Raw Error:`, error);
  }

  // 1. AppError check
  if (error instanceof AppError) {
    return NextResponse.json(
      {
        error: {
          code: error.code,
          message: error.message,
          requestId,
        },
      },
      { status: error.status }
    );
  }

  // 2. Zod validation check
  if (error instanceof ZodError) {
    return NextResponse.json(
      {
        error: {
          code: "INVALID_URL", // returns INVALID_URL to match our contract expectation
          message: error.issues[0]?.message || "Validation failed for request input parameters.",
          requestId,
        },
      },
      { status: 400 }
    );
  }

  // 3. Fallback generic runtime check
  const message = error instanceof Error ? error.message : "An unexpected server error occurred.";
  return NextResponse.json(
    {
      error: {
        code: "INTERNAL_ERROR",
        message,
        requestId,
      },
    },
    { status: 500 }
  );
}
