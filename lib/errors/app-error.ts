/**
 * Unified application error class representing both client-side and server-side errors.
 */
export class AppError extends Error {
  constructor(
    public code: string,
    public status: number,
    message: string
  ) {
    super(message);
    this.name = "AppError";
    
    // Restore prototype chain for extending built-in Error in ES5/ES6 environments
    Object.setPrototypeOf(this, AppError.prototype);
  }

  static invalidRequest(message: string) {
    return new AppError("INVALID_REQUEST", 400, message);
  }

  static invalidUrl(message: string) {
    return new AppError("INVALID_URL", 400, message);
  }

  static unsafeUrl(message: string) {
    return new AppError("UNSAFE_URL", 400, message); // returning 400 for consistency on bad requests
  }

  static pdfNotFound(message: string) {
    return new AppError("PDF_NOT_FOUND", 404, message);
  }

  static pdfInaccessible(message: string) {
    return new AppError("PDF_INACCESSIBLE", 403, message);
  }

  static invalidPdf(message: string) {
    return new AppError("INVALID_PDF", 400, message);
  }

  static pdfTooLarge(message: string) {
    return new AppError("PDF_TOO_LARGE", 400, message); // can also map to 413 Payload Too Large
  }

  static pdfFetchTimeout(message: string) {
    return new AppError("PDF_FETCH_TIMEOUT", 408, message);
  }

  static serviceBusy(message: string) {
    return new AppError("SERVICE_BUSY", 429, message);
  }

  static rateLimitExceeded(message: string) {
    return new AppError("RATE_LIMIT_EXCEEDED", 429, message);
  }

  static analysisTimeout(message: string) {
    return new AppError("ANALYSIS_TIMEOUT", 504, message);
  }

  static analysisFailed(message: string) {
    return new AppError("ANALYSIS_FAILED", 502, message);
  }

  static internal(message: string) {
    return new AppError("INTERNAL_ERROR", 500, message);
  }
}
