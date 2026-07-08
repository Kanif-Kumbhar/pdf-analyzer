import crypto from "crypto";
import { getSupabaseClient } from "./supabase";
import type { AnalysisData } from "../../components/analyzer/analysis-result";

/** Cache TTL in milliseconds (7 days) */
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Normalizes a validated URL to a canonical form for consistent cache key generation.
 * Lowercases the scheme and hostname, strips trailing slashes from the path.
 */
export function normalizeUrl(url: string): string {
  const parsed = new URL(url);
  // Lowercase scheme and host
  parsed.protocol = parsed.protocol.toLowerCase();
  parsed.hostname = parsed.hostname.toLowerCase();
  // Strip trailing slash from path (unless it's just "/")
  if (parsed.pathname.length > 1 && parsed.pathname.endsWith("/")) {
    parsed.pathname = parsed.pathname.slice(0, -1);
  }
  // Sort query parameters alphabetically for consistency
  parsed.searchParams.sort();
  return parsed.toString();
}

/**
 * Computes the SHA-256 hex digest of the normalized URL.
 * Used as the primary key for cache lookups.
 */
export function hashUrl(normalizedUrl: string): string {
  return crypto.createHash("sha256").update(normalizedUrl).digest("hex");
}

export type CacheLookupResult =
  | { hit: true; data: AnalysisData }
  | { hit: false };

/**
 * Looks up a cached analysis result by URL.
 * Returns the cached result if it exists and has not expired (TTL = 7 days).
 * On a cache hit, updates the accessed_at timestamp in the background.
 *
 * @param url The original, validated URL string.
 * @returns The cached result if found and fresh, or `{ hit: false }`.
 */
export async function getCachedAnalysis(url: string): Promise<CacheLookupResult> {
  const normalized = normalizeUrl(url);
  const urlHash = hashUrl(normalized);
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from("analysis_cache")
    .select("result, created_at")
    .eq("url_hash", urlHash)
    .single();

  if (error || !data) {
    return { hit: false };
  }

  // Check if the cache entry has expired (TTL: 7 days)
  const cachedAt = new Date(data.created_at).getTime();
  const isExpired = Date.now() - cachedAt > CACHE_TTL_MS;

  if (isExpired) {
    // Evict the stale entry asynchronously — do not block the request
    supabase
      .from("analysis_cache")
      .delete()
      .eq("url_hash", urlHash)
      .then(() => console.log(`[Cache] Evicted stale entry for hash: ${urlHash}`));

    return { hit: false };
  }

  // Update accessed_at in the background (fire and forget)
  supabase
    .from("analysis_cache")
    .update({ accessed_at: new Date().toISOString() })
    .eq("url_hash", urlHash)
    .then(() => {});

  console.log(`[Cache] HIT: ${url} (hash: ${urlHash.substring(0, 12)}...)`);

  return { hit: true, data: data.result as AnalysisData };
}

/**
 * Stores a new analysis result in the cache (upsert).
 * Silently no-ops if the database write fails — caching is non-critical.
 *
 * @param url The original validated URL string.
 * @param result The validated AnalysisData to store.
 */
export async function setCachedAnalysis(url: string, result: AnalysisData): Promise<void> {
  const normalized = normalizeUrl(url);
  const urlHash = hashUrl(normalized);
  const supabase = getSupabaseClient();

  const now = new Date().toISOString();

  const { error } = await supabase.from("analysis_cache").upsert(
    {
      url_hash: urlHash,
      url: url,
      result: result,
      created_at: now,
      accessed_at: now,
    },
    { onConflict: "url_hash" }
  );

  if (error) {
    // Cache write failure is non-fatal — log it and continue
    console.warn(`[Cache] Failed to write cache entry for ${url}:`, error.message);
  } else {
    console.log(`[Cache] MISS stored: ${url} (hash: ${urlHash.substring(0, 12)}...)`);
  }
}
