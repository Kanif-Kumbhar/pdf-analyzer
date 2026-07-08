import crypto from "crypto";
import { getSupabaseClient } from "./supabase";
import type { AnalysisData } from "../../components/analyzer/analysis-result";

/** Cache TTL in milliseconds (7 days) */
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Computes the SHA-256 hex digest of a string or buffer.
 */
export function sha256(input: string | Buffer): string {
  return crypto.createHash("sha256").update(input).digest("hex");
}

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
 * Used as the primary key for L1 cache lookups.
 */
export function hashUrl(normalizedUrl: string): string {
  return sha256(normalizedUrl);
}

/**
 * Computes the SHA-256 hex digest of raw file bytes.
 * Used as the L2 cache key for PDF contents.
 */
export function hashFileBytes(buffer: Buffer): string {
  return sha256(buffer);
}

export type CacheLookupResult =
  | { hit: true; data: AnalysisData }
  | { hit: false };

/**
 * Looks up a cached analysis result by URL (L1 Cache lookup).
 * Joins `document_urls` and `document_analyses` to retrieve the cached result.
 *
 * @param url The original, validated URL string.
 * @returns The cached result if found and fresh, or `{ hit: false }`.
 */
export async function getCachedAnalysis(url: string): Promise<CacheLookupResult> {
  const normalized = normalizeUrl(url);
  const urlHash = hashUrl(normalized);
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from("document_urls")
    .select(`
      created_at,
      document_analyses (
        id,
        result
      )
    `)
    .eq("url_hash", urlHash)
    .single();

  if (error || !data) {
    return { hit: false };
  }

  // Check if the L1 URL mapping entry has expired (TTL: 7 days)
  const cachedAt = new Date(data.created_at).getTime();
  const isExpired = Date.now() - cachedAt > CACHE_TTL_MS;

  if (isExpired) {
    // Evict the stale URL mapping entry asynchronously
    supabase
      .from("document_urls")
      .delete()
      .eq("url_hash", urlHash)
      .then(() => console.log(`[Cache L1] Evicted stale entry for hash: ${urlHash}`));

    return { hit: false };
  }

  const analysis = data.document_analyses as any;
  if (!analysis || !analysis.result) {
    return { hit: false };
  }

  console.log(`[Cache L1] HIT: ${url} (hash: ${urlHash.substring(0, 12)}...)`);
  return { hit: true, data: analysis.result as AnalysisData };
}

/**
 * Looks up a cached analysis result by the PDF content hash (L2 Cache lookup).
 *
 * @param contentHash The SHA-256 hex hash of the PDF file bytes.
 */
export async function getCachedAnalysisByHash(contentHash: string): Promise<CacheLookupResult> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from("document_analyses")
    .select("result, created_at")
    .eq("content_hash", contentHash)
    .single();

  if (error || !data) {
    return { hit: false };
  }

  const cachedAt = new Date(data.created_at).getTime();
  const isExpired = Date.now() - cachedAt > CACHE_TTL_MS;

  if (isExpired) {
    // Evict the stale L2 analysis entry asynchronously (will cascade delete L1 mappings)
    supabase
      .from("document_analyses")
      .delete()
      .eq("content_hash", contentHash)
      .then(() => console.log(`[Cache L2] Evicted stale analysis for hash: ${contentHash}`));

    return { hit: false };
  }

  console.log(`[Cache L2] HIT: hash ${contentHash.substring(0, 12)}...`);
  return { hit: true, data: data.result as AnalysisData };
}

/**
 * Stores a new analysis result in the L2 cache and maps the source URL to it (L1).
 *
 * @param url The original validated URL string.
 * @param contentHash The SHA-256 hex hash of the PDF file bytes.
 * @param result The validated AnalysisData to store.
 */
export async function setCachedAnalysis(
  url: string,
  contentHash: string,
  result: AnalysisData
): Promise<void> {
  const normalized = normalizeUrl(url);
  const urlHash = hashUrl(normalized);
  const supabase = getSupabaseClient();
  const now = new Date().toISOString();

  // 1. Upsert into document_analyses (L2 Cache)
  const { data: analysisData, error: analysisError } = await supabase
    .from("document_analyses")
    .upsert(
      {
        content_hash: contentHash,
        result: result,
        created_at: now,
        updated_at: now,
      },
      { onConflict: "content_hash" }
    )
    .select("id")
    .single();

  if (analysisError || !analysisData) {
    console.warn(`[Cache L2] Failed to write analysis entry for hash ${contentHash.substring(0, 12)}...:`, analysisError?.message);
    return;
  }

  // 2. Upsert into document_urls (L1 Cache)
  const { error: urlError } = await supabase.from("document_urls").upsert(
    {
      url_hash: urlHash,
      source_url: url,
      analysis_id: analysisData.id,
      created_at: now,
    },
    { onConflict: "url_hash" }
  );

  if (urlError) {
    console.warn(`[Cache L1] Failed to map URL ${url} to analysis ID ${analysisData.id}:`, urlError.message);
  } else {
    console.log(`[Cache Hybrid] Stored URL and content mapping for ${url}`);
  }
}

/**
 * Maps a new URL to an existing analysis record in the L2 cache.
 *
 * @param url The new validated URL string.
 * @param contentHash The SHA-256 hex hash of the PDF file bytes.
 */
export async function mapUrlToAnalysis(url: string, contentHash: string): Promise<void> {
  const normalized = normalizeUrl(url);
  const urlHash = hashUrl(normalized);
  const supabase = getSupabaseClient();
  const now = new Date().toISOString();

  // Find the existing document_analyses ID
  const { data: analysisData, error: searchError } = await supabase
    .from("document_analyses")
    .select("id")
    .eq("content_hash", contentHash)
    .single();

  if (searchError || !analysisData) {
    console.warn(`[Cache L1] Cannot map URL because analysis for hash ${contentHash.substring(0, 12)}... was not found.`);
    return;
  }

  // Map the new URL to this analysis
  const { error: urlError } = await supabase.from("document_urls").upsert(
    {
      url_hash: urlHash,
      source_url: url,
      analysis_id: analysisData.id,
      created_at: now,
    },
    { onConflict: "url_hash" }
  );

  if (urlError) {
    console.warn(`[Cache L1] Failed to map URL ${url} to analysis ID ${analysisData.id}:`, urlError.message);
  } else {
    console.log(`[Cache L1] Mapped new URL ${url} to existing analysis ID ${analysisData.id}`);
  }
}

/**
 * Stores an analysis result from a file upload in the L2 cache.
 * Note: Uploads do not have a standard public URL, so they don't get an L1 mapping.
 *
 * @param contentHash The SHA-256 hex hash of the file bytes.
 * @param filename The original filename.
 * @param result The validated AnalysisData to store.
 */
export async function setCachedAnalysisByHash(
  contentHash: string,
  filename: string,
  result: AnalysisData
): Promise<void> {
  const supabase = getSupabaseClient();
  const now = new Date().toISOString();

  const { error } = await supabase.from("document_analyses").upsert(
    {
      content_hash: contentHash,
      result: result,
      created_at: now,
      updated_at: now,
    },
    { onConflict: "content_hash" }
  );

  if (error) {
    console.warn(`[Cache L2] Failed to write upload entry for ${filename}:`, error.message);
  } else {
    console.log(`[Cache L2] Stored upload result for ${filename} (hash: ${contentHash.substring(0, 12)}...)`);
  }
}
