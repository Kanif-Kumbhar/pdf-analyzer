import { getSupabaseClient } from "./supabase";

export interface HistoryItem {
  url: string;
  title: string;
  accessed_at: string;
}

// Record a search history entry for a given IP hash.
export async function recordSearchHistory(ipHash: string, url: string, title: string): Promise<void> {
  const supabase = getSupabaseClient();
  const now = new Date().toISOString();

  const { error } = await supabase.from("search_history").upsert(
    {
      ip_hash: ipHash,
      url: url,
      title: title,
      accessed_at: now,
    },
    { onConflict: "ip_hash,url" }
  );

  if (error) {
    console.warn(`[History] Failed to record search history for ${url}:`, error.message);
  }
}

// Retrieve paginated search history for a given IP hash.
export async function getSearchHistory(
  ipHash: string,
  page: number = 1,
  pageSize: number = 3
): Promise<{ items: HistoryItem[]; totalCount: number }> {
  const supabase = getSupabaseClient();
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  // Query count and items in parallel
  const [countRes, itemsRes] = await Promise.all([
    supabase
      .from("search_history")
      .select("id", { count: "exact", head: true })
      .eq("ip_hash", ipHash),
    supabase
      .from("search_history")
      .select("url, title, accessed_at")
      .eq("ip_hash", ipHash)
      .order("accessed_at", { ascending: false })
      .range(from, to),
  ]);

  return {
    items: (itemsRes.data || []) as HistoryItem[],
    totalCount: countRes.count || 0,
  };
}
