# ADR 003: Caching Strategy

## Status
Accepted (Evolved to Two-Level Hybrid Cache)

## Decision

The application implements a **Two-Level Durable Caching Architecture** in Supabase PostgreSQL:

```
                  ┌──────────────────────┐
                  │ L1 Cache (URL Hash)  │
                  └──────────┬───────────┘
                             │ (Miss)
                             ▼
                  ┌──────────────────────┐
                  │ Fetch & Validate PDF │
                  └──────────┬───────────┘
                             │
                             ▼
                  ┌──────────────────────┐
                  │ L2 Cache (Content)   │
                  └──────────────────────┘
```

1. **L1 Location Cache (`document_urls` table)**: Keys the cache using `sha256(normalized_url)`. On a hit, it returns the cached result immediately, bypassing both the PDF fetch and Gemini API call.
2. **L2 Content Cache (`document_analyses` table)**: Keys the cache using `sha256(pdf_bytes)`. On an L1 miss, the PDF is downloaded and hashed. If the content hash hits L2, the existing analysis result is returned, and a new L1 URL mapping is created in the database.
3. **AI Quota Placement**: AI quota reservation is deferred until both L1 and L2 cache levels miss, preventing quota consumption on any cache hit.
4. **Cache TTL**: Both cache levels expire entries after 7 days (via `created_at` timestamp check during lookup, with background deletion).

---

## History of Evolution

### Phase 1: Simple URL-Based Caching (Legacy)
Initially, the system used a flat, single-table cache (`analysis_cache`) keyed strictly by the PDF URL. 
* **Limitation 1**: If the same PDF was hosted on two different URLs, the application would call Gemini twice and consume twice the user-facing AI quota.
* **Limitation 2**: Direct drag-and-drop file uploads could not be cached effectively because they lacked a stable URL.

### Phase 2: Hybrid L1/L2 Caching (Current)
To solve these limitations, we separated the cache into two normalized tables. Uploaded files bypass L1 and check L2 directly using their content hash. URL requests check L1 first (fast path) and fall back to L2 after fetching (deduplication path).

---

## Reason
1. **Quota Efficiency**: Completely eliminates Gemini calls for duplicate files, even if accessed from different URLs or uploaded directly.
2. **Support for Uploads**: Enables robust content-addressed caching for direct file uploads.
3. **Performance Optimization**: L1 lookups bypass network I/O to fetch PDFs, yielding sub-100ms response times.
4. **DB Normalization**: Prevents duplicate JSON analysis payloads from taking up redundant rows in the database.

---

## Alternatives Considered
* **Content Cache Only**: Querying strictly by `sha256(pdf_bytes)`. Rejected because it would require fetching the PDF bytes from the remote server for *every* URL request before checking the cache, wasting server bandwidth and increasing latency.
* **No Cache**: Rejected because duplicate analyses would consume expensive Gemini API limits and increase user wait times.

---

## Trade-offs & Future Improvements

### The Stale URL Mapping Problem
Under L1 caching, if a remote PDF file changes at a URL (e.g. a daily report updated under the same filename), the L1 check will return the stale analysis of the old content for up to 7 days.

### Future Improvement: ETag / Last-Modified Revalidation
To keep the fast L1 cache while guaranteeing fresh results, a future version can implement **HTTP Conditional Headers**:
1. When storing an L1 URL mapping, store the origin server's `ETag` and `Last-Modified` headers.
2. On an L1 cache hit, perform a fast `HEAD` request to the origin server containing `If-None-Match: <ETag>` and/or `If-Modified-Since: <Last-Modified>`.
3. If the origin server returns `304 Not Modified`, return the L1 cached result (bypassing download).
4. If it returns `200 OK` (indicating the file changed), download the new PDF, re-hash, check L2, and update the mappings.
