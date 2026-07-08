# ADR 004: Two-Tier Rate Limiting

## Status
Accepted

## Decision
Implement two independent IP-based rate limits persisted in the Supabase `rate_limits` table:

1. **General Request Limit**: Applied to every analysis API request (default: 100/hour) to protect application and database resources.
2. **AI Analysis Limit**: Applied using an atomic **reserve-execute-finalize/refund** model (default: 10/hour) to prevent concurrency races.

For the AI limit, the transaction flow works as follows:
- On a cache miss, before initiating PDF downloading, the application calls a PostgreSQL RPC function (`reserve_analysis_quota`). It uses database-level row locking (`SELECT ... FOR UPDATE`) on the IP hash row to serialize checks, atomically checking remaining credits and incrementing the count by 1.
- If the PDF download fails, times out, or fails security checks (i.e. before calling the LLM), the application invokes `refund_analysis_quota` to decrement the usage count.
- If the Gemini API invocation is initiated, the slot is permanently consumed (regardless of whether the model fails or the resulting JSON fails schema validation), as API provider costs were already incurred.

Client IP addresses are not stored directly. They are hashed using SHA-256 with a server-side `RATE_LIMIT_SALT` before being used as rate-limit identifiers.

## Reason
1. **LLM Quota Protection**: Cache hits do not consume the limited AI analysis budget because they avoid Gemini entirely.
2. **Concurrency Safety**: Lock-based reservation prevents a user from bypassing the 10/hour limit by sending multiple simultaneous concurrent requests.
3. **Fair Usage**: Network-level fetch errors occurring before the LLM stage do not count against the user.
4. **Traffic Protection**: The general request limit protects API, compute, and database resources independently of LLM usage.

## Alternatives
- **Single Rate Limit**: Rejected because inexpensive cache hits and expensive LLM analyses have different resource costs.
- **Client-Side/In-Memory Rate Limiting**: Rejected because serverless runtimes do not provide shared persistent state across requests.
- **Client-side Non-Atomic Counter**: Rejected because multiple concurrent requests can read the same count and bypass limits (e.g. 5 concurrent requests at 9/10 all completing successfully before the counter updates).

## Trade-offs
Row-level locks in PostgreSQL serialize concurrent requests for the same IP, which can cause slight latency delays for a user spamming requests. Additionally, it requires extra database round-trips for refunds on failure. This is accepted to ensure strict rate enforcement and cost protection.