import { NextResponse } from "next/server";
import { AppError } from "./app-error";
import { ZodError } from "zod";

/**
 * Centrally maps errors (AppError, ZodError, or generic Error) to formatted JSON NextResponses.
 * Implements a 2-layer error architecture:
 * Layer 1 (Backend): Logs detailed error reasons and stack traces to the server console.
 * Layer 2 (Frontend): Returns user-friendly, masked JSON responses to prevent sensitive information leakage.
 *
 * @param error The thrown error object.
 * @param requestId Unique identifier for request tracing.
 * @returns NextResponse formatted to client specifications.
 */
export function mapErrorToResponse(error: unknown, requestId: string): NextResponse {
  // --- LAYER 1: Backend Detailed Logging ---
  console.error(`\n[ERROR] RequestId: ${requestId}`);
  if (error instanceof Error) {
    console.error(`Code/Name: ${error.name === "AppError" ? (error as AppError).code : error.name}`);
    console.error(`Message: ${error.message}`);
    if (error.stack) {
      console.error(error.stack);
    }
  } else {
    console.error(`Raw Error:`, error);
  }
  console.error(`----------------------------------------\n`);

  // --- LAYER 2: Frontend User-Friendly Response ---
  const isProduction = process.env.NODE_ENV === "production";

  let code = "INTERNAL_ERROR";
  let message = "Something went wrong.";
  let status = 500;

  if (error instanceof AppError) {
    code = error.code;
    message = error.message;
    status = error.status;

    // Direct mapping for AppErrors to guarantee uniform client messages
    if (code === "INVALID_URL") {
      message = "Please enter a valid HTTP or HTTPS URL.";
    } else if (code === "UNSAFE_URL") {
      message = "This URL cannot be accessed for security reasons.";
    } else if (code === "PDF_NOT_FOUND") {
      message = "The PDF could not be found (404).";
    } else if (code === "PDF_INACCESSIBLE") {
      // Retain Google Drive authorization help message, otherwise map to standard
      if (!message.includes("Google Drive")) {
        message = "The provided URL does not point to a valid PDF document.";
      }
    } else if (code === "INVALID_PDF") {
      message = "The provided URL does not point to a valid PDF document.";
    } else if (code === "PDF_TOO_LARGE") {
      message = "This PDF exceeds the maximum supported size.";
    } else if (code === "PDF_FETCH_TIMEOUT") {
      message = "The document took too long to respond. Please try another source.";
    } else if (code === "RATE_LIMIT_EXCEEDED") {
      message = "Too many analysis requests. Please wait a few minutes.";
    } else if (code === "ANALYSIS_TIMEOUT") {
      message = "Analysis timed out. Please retry.";
    } else if (code === "ANALYSIS_FAILED") {
      const isOverload = message.includes("high demand") || message.includes("UNAVAILABLE") || message.includes("503") || message.includes("spikes in demand");
      if (isOverload) {
        code = "SERVICE_BUSY";
        message = "The analysis service is currently experiencing high demand. Please try again later.";
        status = 503;
      } else {
        message = isProduction 
          ? "Analysis service is temporarily unavailable." 
          : error.message;
      }
    } else if (code === "SERVICE_CONFIGURATION_ERROR") {
      message = isProduction 
        ? "Analysis service is temporarily unavailable." 
        : error.message;
    }
  } else if (error instanceof ZodError) {
    code = "INVALID_URL";
    message = "Please enter a valid HTTP or HTTPS URL.";
    status = 400;
  } else if (error instanceof Error) {
    const errorMsg = error.message;
    const isConfigError = errorMsg.includes("GEMINI_API_KEY") || errorMsg.includes("API_KEY") || errorMsg.includes("secret") || errorMsg.includes("token");
    const isOverload = errorMsg.includes("high demand") || errorMsg.includes("UNAVAILABLE") || errorMsg.includes("503") || errorMsg.includes("spikes in demand");

    if (isConfigError) {
      code = "SERVICE_CONFIGURATION_ERROR";
      message = isProduction 
        ? "Analysis service is temporarily unavailable." 
        : errorMsg;
    } else if (isOverload) {
      code = "SERVICE_BUSY";
      message = "The analysis service is currently experiencing high demand. Please try again later.";
      status = 503;
    } else if (errorMsg.includes("timeout") || errorMsg.includes("deadline")) {
      code = "ANALYSIS_TIMEOUT";
      message = "Analysis timed out. Please retry.";
    } else if (errorMsg.includes("schema") || errorMsg.includes("JSON")) {
      code = "ANALYSIS_FAILED";
      message = "Analysis failed. Please retry.";
    } else {
      code = "INTERNAL_ERROR";
      message = isProduction 
        ? "Something went wrong." 
        : errorMsg;
    }
  }

  return NextResponse.json(
    {
      error: {
        code,
        message,
        requestId,
      },
    },
    { status }
  );
}
