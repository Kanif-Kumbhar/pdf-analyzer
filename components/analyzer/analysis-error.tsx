import React from "react";

interface AnalysisErrorProps {
  code?: string | null;
  message: string;
  requestId?: string | null;
  onRetry?: () => void;
}

export default function AnalysisError({ code, message, requestId, onRetry }: AnalysisErrorProps) {
  // Determine if this is a backend service / configuration / generic system error
  const isSystemError =
    code === "SERVICE_CONFIGURATION_ERROR" ||
    code === "INTERNAL_ERROR" ||
    code === "ANALYSIS_FAILED" ||
    code === "CLIENT_FETCH_ERROR";

  const isRateLimit = code === "RATE_LIMIT_EXCEEDED" || code === "SERVICE_BUSY";

  let title = "Analysis Failed";
  let displayMessage = message;

  // Map display fields based on error type
  if (isSystemError) {
    title = "Analysis Service Unavailable";
    
    // Mask sensitive configurations if they slip into development messages
    const containsSecrets = 
      message.includes("API_KEY") || 
      message.includes("secret") || 
      message.includes("token") || 
      message.includes(".env");
      
    if (containsSecrets) {
      displayMessage = "We couldn't analyze your document because the analysis service is currently unavailable. Please try again later.";
    } else {
      displayMessage = message;
    }
  } else if (isRateLimit) {
    title = "Rate Limit Exceeded";
    displayMessage = message || "Too many analysis requests. Please wait a few minutes.";
  }

  return (
    <div className="w-full max-w-4xl bg-surface-container-lowest border border-outline-variant/30 rounded-[20px] shadow-card p-8 sm:p-12 flex flex-col items-center text-center transition-all duration-300 relative overflow-hidden">
      {/* Background radial glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[350px] h-[350px] bg-gradient-to-b from-error/5 to-transparent rounded-full blur-3xl pointer-events-none"></div>

      {/* Decorative top accent line */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-error/30 via-error to-error/30"></div>

      {/* Glowing Error Icon */}
      <div className="relative mb-6">
        <div className="w-20 h-20 rounded-full bg-error-container/30 flex items-center justify-center animate-pulse">
          <div className="w-14 h-14 rounded-full bg-error-container flex items-center justify-center shadow-inner">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
              className="w-7 h-7 text-error"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 9v3.75m0-10.036A11.959 11.959 0 0 1 3.598 6c-.567 0-1.114-.024-1.657-.072a11.954 11.954 0 0 0 9.056 9.056c.543-.048 1.09-.072 1.657-.072c1.785 0 3.486.39 5.021 1.088A12.01 12.01 0 0 1 12 21.75c-2.483 0-4.8-.755-6.732-2.054a11.97 11.97 0 0 0 1.258-2.696m1.258-2.696a11.959 11.959 0 0 1-5.118-2.097"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 9v3.75m0 3.75h.008v.008H12v-.008Z"
              />
            </svg>
          </div>
        </div>
        {/* Little exclamation badge */}
        <span className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-error text-[11px] font-bold text-on-error shadow-md">
          !
        </span>
      </div>

      {/* Main Content */}
      <h3 className="font-display text-2xl sm:text-3xl font-extrabold text-on-surface mb-3 tracking-tight">
        {title}
      </h3>
      
      <p className="font-body-lg text-body-lg text-on-surface-variant max-w-xl leading-relaxed whitespace-pre-wrap">
        {displayMessage}
      </p>

      {/* Request ID badge */}
      {requestId && (
        <p className="text-xs text-on-surface-variant/80 mt-4 font-mono">
          Request ID: <code className="bg-surface-container px-2 py-0.5 rounded border border-outline-variant/30 font-semibold">{requestId}</code>
        </p>
      )}

      {/* Troubleshooting Checklist — Only show for user action required inputs */}
      {!isSystemError && !isRateLimit && (
        <div className="w-full max-w-xl bg-surface-container-low/40 border border-outline-variant/20 rounded-[16px] p-5 my-8 text-left backdrop-blur-sm">
          <h4 className="font-label-md text-[13px] font-bold text-on-surface uppercase tracking-wider mb-4 flex items-center gap-2">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
              className="w-4 h-4 text-error"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
              />
            </svg>
            Verification Checklist
          </h4>
          <ul className="space-y-3">
            <li className="flex items-start gap-3 text-[13px] sm:text-sm text-on-surface-variant leading-relaxed">
              <span className="w-1.5 h-1.5 rounded-full bg-error mt-2 shrink-0"></span>
              <span>Verify the URL points directly to a valid PDF document (usually ends in <code className="font-mono bg-surface-container-high px-1 py-0.5 rounded text-xs font-semibold">.pdf</code>).</span>
            </li>
            <li className="flex items-start gap-3 text-[13px] sm:text-sm text-on-surface-variant leading-relaxed">
              <span className="w-1.5 h-1.5 rounded-full bg-error mt-2 shrink-0"></span>
              <span>Check that the URL is public and does not require credentials, cookies, or captcha to access.</span>
            </li>
            <li className="flex items-start gap-3 text-[13px] sm:text-sm text-on-surface-variant leading-relaxed">
              <span className="w-1.5 h-1.5 rounded-full bg-error mt-2 shrink-0"></span>
              <span>Ensure the host server permits automated requests (no anti-bot shields like Cloudflare blockages).</span>
            </li>
          </ul>
        </div>
      )}

      {/* Action Buttons */}
      <div className={`flex flex-col sm:flex-row items-center gap-3 ${isSystemError || isRateLimit ? "mt-8" : ""}`}>
        {onRetry && (
          <button
            onClick={onRetry}
            className="inline-flex items-center gap-2 bg-error text-on-error hover:bg-error/95 font-label-md text-sm font-bold px-6 py-3 rounded-xl transition-all duration-200 shadow-md shadow-error/10 hover:shadow-lg hover:shadow-error/25 hover:-translate-y-0.5 cursor-pointer active:translate-y-0"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2.5}
              stroke="currentColor"
              className="w-4 h-4"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99"
              />
            </svg>
            Try Again
          </button>
        )}
      </div>
    </div>
  );
}

