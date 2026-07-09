# ADR 006: Future Enhancements and Scaling Strategy

## Status
Proposed

## Context
The current application uses a Next.js application deployed on serverless infrastructure, with Supabase PostgreSQL providing persistent caching and rate-limit state.

This architecture is suitable for the current workload, but synchronous document processing has limitations as concurrency, document size, processing time, and external API usage increase.

This record defines the proposed evolution of the system for higher scale, improved resilience, stronger workload isolation, and broader document support.

---

## 1. Asynchronous Document Processing

### Current Limitation
PDF fetching, validation, metadata extraction, and LLM analysis currently execute synchronously within the API request lifecycle.

Long-running document processing increases request duration and couples user-facing API availability with external PDF hosts and LLM provider latency.

### Proposed Evolution
Move expensive analysis work to an asynchronous job-processing architecture.

```text
Client
   │
   │ POST /analyses
   ▼
API Layer
   │
   ├── Validate request
   ├── Check cache
   ├── Create or reuse analysis job
   │
   ▼
Message Queue
   │
   ▼
Analysis Workers
   │
   ├── Fetch document
   ├── Validate PDF
   ├── Compute content hash
   ├── Check content cache
   ├── Extract metadata / OCR if required
   ├── Call analysis provider
   └── Validate and persist result
   │
   ▼
PostgreSQL / Cache
```

The API can return:

```text
202 Accepted
analysisId: <id>
status: queued
```

The frontend can receive progress through:

* status polling for the simplest implementation;
* Server-Sent Events for one-way progress updates;
* WebSockets only if future requirements justify bidirectional real-time communication.

Example states:

```text
QUEUED
→ FETCHING
→ VALIDATING
→ PROCESSING
→ ANALYZING
→ COMPLETED

or

→ FAILED
```

This separates request handling from long-running document processing and allows workers to scale independently.

---

## 2. Multi-Level Caching and Request Coalescing

### Multi-Level Cache

The caching architecture can evolve into:

```text
L0: Optional Redis hot-result cache
        ↓ miss
L1: URL hash lookup
        ↓ miss
Fetch and validate PDF
        ↓
L2: Content hash lookup
        ↓ miss
Analysis pipeline
```

Responsibilities:

* **Redis**: short-lived hot results, distributed rate-limit counters, job coordination, and short-lived locks.
* **PostgreSQL**: durable analysis results, URL-to-content mappings, job state, and historical records.

### Request Coalescing

Concurrent requests for the same uncached document should share one analysis job.

Example:

```text
Request A ─┐
Request B ─┤
Request C ─┼──► Same document identity
Request D ─┤             │
Request E ─┘             ▼
                    Existing job?
                     │         │
                    Yes        No
                     │         │
                     ▼         ▼
                 Reuse Job   Create Job
                     │         │
                     └────┬────┘
                          ▼
                    Single Analysis
                          │
                          ▼
                     Shared Result
```

A distributed lock or atomic job-creation operation can ensure that only one worker processes a given document identity at a time.

Other requests should reuse the existing job ID or cached result rather than holding synchronous HTTP connections open.

---

## 3. LLM Resilience and Cost Management

### Provider Resilience

LLM failures should be handled according to failure type.

```text
Primary Model
     │
     ├── Success
     │      ↓
     │   Validate Output
     │      ↓
     │   Persist Result
     │
     └── Retryable Failure
            │
            ▼
       Bounded Retry
            │
            ├── Success
            │
            └── Failure
                   │
                   ▼
              Fallback Policy
```

Fallback should be applied only to appropriate failures such as:

* temporary provider unavailability;
* repeated timeout;
* provider capacity errors;
* explicitly supported output-recovery cases.

Authentication failures, invalid requests, unsupported documents, and security validation failures should not trigger provider fallback.

### Model Routing

Different workloads may use different processing strategies based on:

* document size;
* page count;
* document type;
* OCR requirement;
* expected analysis complexity;
* latency requirements;
* provider cost.

Example:

```text
Document
    │
    ▼
Complexity Classification
    │
    ├── Standard Document
    │        ↓
    │   Fast / Cost-Efficient Model
    │
    └── Complex Document
             ↓
        Advanced Analysis Model
```

Provider abstraction should remain behind the analysis service so model or provider changes do not affect API routes or frontend code.

Cross-provider fallback should only be introduced after normalizing provider-specific request formats, structured-output validation, file handling, and error mapping.

---

## 4. Document Isolation and Processing Security

### Current Risk

PDFs are untrusted binary inputs.

Although the current application limits file size, validates document type, and restricts network access, future processing may introduce native PDF parsers, OCR engines, converters, or other complex document-processing tools.

These components increase the attack surface.

### Proposed Evolution

Move high-risk document processing into isolated worker environments.

```text
Untrusted PDF
      │
      ▼
Isolated Processing Worker
      │
      ├── Resource limits
      ├── CPU limits
      ├── Memory limits
      ├── Execution timeout
      ├── Restricted filesystem
      └── Restricted network access
      │
      ▼
Validated Processing Output
      │
      ▼
Analysis Pipeline
```

Isolation technologies may include container sandboxes, restricted worker runtimes, or dedicated document-processing services depending on infrastructure requirements.

The main API application should orchestrate jobs rather than perform high-risk document transformation directly.

---

## 5. Conditional OCR Pipeline

### Problem

Some PDFs contain selectable text, while others are scanned images with little or no extractable text.

Running OCR for every document would unnecessarily increase latency and processing cost.

### Proposed Evolution

Use OCR only when required.

```text
PDF
 │
 ▼
Text Availability Check
 │
 ├── Sufficient Text
 │        │
 │        ▼
 │   Normal Analysis Pipeline
 │
 └── Insufficient Text
          │
          ▼
         OCR
          │
          ▼
     Extracted Text
          │
          ▼
     Analysis Pipeline
```

Possible OCR engines include self-hosted OCR workers or managed document-processing services.

The selected approach should depend on document volume, language requirements, accuracy needs, operational complexity, and cost.

---

## 6. Observability and Operational Resilience

At higher scale, structured logging should evolve into full request and job observability.

The system should track:

* request latency;
* queue wait time;
* document fetch duration;
* cache hit ratio;
* URL-cache vs content-cache hits;
* LLM latency and failure rate;
* token usage and estimated provider cost;
* OCR usage rate;
* analysis job success/failure rate;
* worker retry count.

A shared correlation ID should connect:

```text
API Request
    ↓
Analysis Job
    ↓
Worker Execution
    ↓
Provider Request
    ↓
Stored Result
```

This makes failures traceable across asynchronous system boundaries.

---

## Evolution Path

The architecture should evolve incrementally rather than introducing all components at once.

```text
Current Architecture
Next.js + Supabase + Gemini
        │
        ▼
Stage 1
Hybrid URL + Content Cache
        │
        ▼
Stage 2
Queue + Background Workers
        │
        ▼
Stage 3
Request Coalescing + Distributed Rate Limiting
        │
        ▼
Stage 4
Conditional OCR + Isolated Processing
        │
        ▼
Stage 5
Model Routing + Provider Resilience
        │
        ▼
Stage 6
Advanced Observability and Cost Controls
```

## Trade-offs

The proposed architecture improves concurrency, resilience, workload isolation, and cost control, but introduces additional infrastructure and operational complexity.

The system should adopt these components only when workload characteristics justify them. The current architecture remains intentionally simpler, while preserving clear boundaries that allow document processing, caching, rate limiting, and provider integrations to evolve independently.
