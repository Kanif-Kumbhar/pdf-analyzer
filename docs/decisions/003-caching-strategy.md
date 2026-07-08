# ADR 003: Caching Strategy

## Status
Accepted

## Decision
Cache successfully validated Gemini analysis results in Supabase PostgreSQL.

For each request, the application normalizes the PDF URL and generates a SHA-256 hash as the cache key. On a cache hit, the stored result is returned without fetching the PDF or calling Gemini. On a miss, the normal analysis pipeline runs and the validated result is cached.

## Reason
1. **Quota Control**: Prevents repeated Gemini calls for previously analyzed PDF URLs.
2. **Performance**: Cache hits avoid PDF downloading and LLM processing, significantly reducing response time.
3. **Simplicity**: Supabase is already part of the architecture, avoiding an additional caching service.

## Alternatives
- **No Cache**: Rejected because repeated requests would unnecessarily consume LLM quota and increase latency.
- **In-Memory Cache**: Rejected because serverless instances do not provide reliable shared persistent memory.
- **Redis**: Not selected for the current scale because it adds infrastructure complexity. It may be useful later for hot caching, distributed rate limiting, or request coalescing.

## Trade-offs
URL-based caching may return stale results if a PDF changes at the same URL. Identical PDFs hosted at different URLs are also analyzed separately.

For the current use case of mostly static documents, this is acceptable. A future version could add content-hash deduplication, TTL-based expiration, or ETag/Last-Modified revalidation.
