import crypto from "crypto";
import { getSupabaseClient } from "../db/supabase";
import { AppError } from "../errors/app-error";

// Configurable constants with safe defaults
const REQ_WINDOW_MS = process.env.RATE_LIMIT_REQUEST_WINDOW_MS
  ? parseInt(process.env.RATE_LIMIT_REQUEST_WINDOW_MS, 10)
  : 60 * 60 * 1000; // 1 hour

const REQ_MAX = process.env.RATE_LIMIT_REQUEST_MAX
  ? parseInt(process.env.RATE_LIMIT_REQUEST_MAX, 10)
  : 100;

const ANALYZE_WINDOW_MS = process.env.RATE_LIMIT_ANALYSIS_WINDOW_MS
  ? parseInt(process.env.RATE_LIMIT_ANALYSIS_WINDOW_MS, 10)
  : 60 * 60 * 1000; // 1 hour

const ANALYZE_MAX = process.env.RATE_LIMIT_ANALYSIS_MAX
  ? parseInt(process.env.RATE_LIMIT_ANALYSIS_MAX, 10)
  : 10;

const RATE_LIMIT_SALT = process.env.RATE_LIMIT_SALT || "secure_default_ip_salt_string";

export function getClientIp(request: Request): string {
  const xForwardedFor = request.headers.get("x-forwarded-for");
  if (xForwardedFor) {
    return xForwardedFor.split(",")[0].trim();
  }
  const xRealIp = request.headers.get("x-real-ip");
  if (xRealIp) {
    return xRealIp;
  }
  return "127.0.0.1";
}

export function hashIp(ip: string): string {
  return crypto.createHash("sha256").update(`${ip}:${RATE_LIMIT_SALT}`).digest("hex");
}

export interface LimitStatus {
  requestRemaining: number;
  requestMax: number;
  analysisRemaining: number;
  analysisMax: number;
  analysisResetSeconds: number;
}

/**
 * Normalizes user limits row. Resets windows if expired.
 */
async function getOrCreateLimitRow(supabase: any, ipHash: string, now: Date) {
  const { data: row, error } = await supabase
    .from("rate_limits")
    .select("*")
    .eq("ip_hash", ipHash)
    .maybeSingle();

  if (error) throw error;

  if (!row) {
    const newRow = {
      ip_hash: ipHash,
      request_count: 0,
      request_window_start: now.toISOString(),
      analysis_count: 0,
      analysis_window_start: now.toISOString(),
    };
    const { error: insertError } = await supabase.from("rate_limits").insert(newRow);
    if (insertError) throw insertError;
    return newRow;
  }

  let updatePayload: Record<string, any> = {};

  // Check general request window
  const reqStart = new Date(row.request_window_start);
  if (now.getTime() - reqStart.getTime() > REQ_WINDOW_MS) {
    updatePayload.request_count = 0;
    updatePayload.request_window_start = now.toISOString();
    row.request_count = 0;
    row.request_window_start = now.toISOString();
  }

  // Check LLM analysis window
  const analyzeStart = new Date(row.analysis_window_start);
  if (now.getTime() - analyzeStart.getTime() > ANALYZE_WINDOW_MS) {
    updatePayload.analysis_count = 0;
    updatePayload.analysis_window_start = now.toISOString();
    row.analysis_count = 0;
    row.analysis_window_start = now.toISOString();
  }

  if (Object.keys(updatePayload).length > 0) {
    await supabase.from("rate_limits").update(updatePayload).eq("ip_hash", ipHash);
  }

  return row;
}

/**
 * 1. Checks and increments general API request rate limit.
 * Runs at the very start of every API call (including cache hits).
 */
export async function checkGeneralRateLimit(request: Request): Promise<void> {
  const ip = getClientIp(request);
  const ipHash = hashIp(ip);
  const supabase = getSupabaseClient();
  const now = new Date();

  try {
    const row = await getOrCreateLimitRow(supabase, ipHash, now);

    if (row.request_count >= REQ_MAX) {
      const windowStart = new Date(row.request_window_start);
      const elapsed = now.getTime() - windowStart.getTime();
      const retryAfter = Math.ceil((REQ_WINDOW_MS - elapsed) / 1000);
      throw AppError.rateLimitExceeded(
        `General request limit exceeded. Try again in ${retryAfter} seconds.`
      );
    }

    // Increment general request count
    await supabase
      .from("rate_limits")
      .update({ request_count: row.request_count + 1 })
      .eq("ip_hash", ipHash);
  } catch (err) {
    if (err instanceof AppError) throw err;
    console.error("[Rate Limit] Error checking general limits:", err);
  }
}

/**
 * 2. Atomically reserves an analysis quota slot.
 * Returns normally if slot was reserved successfully, throws AppError if limit exceeded.
 */
export async function reserveAnalysisQuota(request: Request): Promise<void> {
  const ip = getClientIp(request);
  const ipHash = hashIp(ip);
  const supabase = getSupabaseClient();

  try {
    const { data, error } = await supabase.rpc("reserve_analysis_quota", {
      p_ip_hash: ipHash,
      p_max_count: ANALYZE_MAX,
      p_window_ms: ANALYZE_WINDOW_MS,
    });

    if (error) throw error;

    if (!data.success) {
      const windowStart = new Date(data.analysis_window_start);
      const now = new Date();
      const elapsed = now.getTime() - windowStart.getTime();
      const retryAfter = Math.max(1, Math.ceil((ANALYZE_WINDOW_MS - elapsed) / 1000));
      throw AppError.rateLimitExceeded(
        `AI Analysis limit exceeded. Try again in ${retryAfter} seconds.`
      );
    }
  } catch (err) {
    if (err instanceof AppError) throw err;
    console.error("[Rate Limit] Error reserving analysis quota:", err);
    throw AppError.internal("An error occurred while validating rate limits.");
  }
}

/**
 * 3. Refunds a reserved analysis quota slot (e.g. if fetch or validation fails before Gemini).
 */
export async function refundAnalysisQuota(request: Request): Promise<void> {
  const ip = getClientIp(request);
  const ipHash = hashIp(ip);
  const supabase = getSupabaseClient();

  try {
    const { error } = await supabase.rpc("refund_analysis_quota", {
      p_ip_hash: ipHash,
    });
    if (error) throw error;
  } catch (err) {
    console.error("[Rate Limit] Error refunding analysis quota:", err);
  }
}

/**
 * Exposes current limit status for the frontend UI.
 */
export async function getRateLimitStatus(request: Request): Promise<LimitStatus> {
  const ip = getClientIp(request);
  const ipHash = hashIp(ip);
  const supabase = getSupabaseClient();
  const now = new Date();

  try {
    const row = await getOrCreateLimitRow(supabase, ipHash, now);

    const requestRemaining = Math.max(0, REQ_MAX - row.request_count);
    const analysisRemaining = Math.max(0, ANALYZE_MAX - row.analysis_count);

    const windowStart = new Date(row.analysis_window_start);
    const elapsed = now.getTime() - windowStart.getTime();
    const analysisResetSeconds = Math.max(0, Math.ceil((ANALYZE_WINDOW_MS - elapsed) / 1000));

    return {
      requestRemaining,
      requestMax: REQ_MAX,
      analysisRemaining,
      analysisMax: ANALYZE_MAX,
      analysisResetSeconds,
    };
  } catch {
    return {
      requestRemaining: REQ_MAX,
      requestMax: REQ_MAX,
      analysisRemaining: ANALYZE_MAX,
      analysisMax: ANALYZE_MAX,
      analysisResetSeconds: 0,
    };
  }
}
