# ADR 005: Gemini Response Schema

## Status
Accepted

## Decision
Utilize the Google Gen AI SDK's native `responseMimeType: "application/json"` and `responseSchema` parameters inside [gemini.ts](file:///d:/Programming/pdf-analyzer/lib/providers/gemini.ts) during model invocation. This enforces structured JSON outputs directly from the model to match the properties of our analysis metadata (e.g. `documentType`, `keyTakeaway`, `keyPoints`, `targetAudience`, etc.).

This is paired with a post-invocation Zod schema check using `pdfAnalysisSchema` inside [route.ts](file:///d:/Programming/pdf-analyzer/app/api/analyze/route.ts) before caching or returning payloads.

## Reason
1. **JSON Parsing Reliability**: Standard text prompts requesting JSON strings are notoriously fragile. They frequently insert markdown formatting (e.g. \`\`\`json ... \`\`\`), conversational text, or invalid formatting, leading to server-side parser failures.
2. **Predictable Types**: Directly declaring schema requirements forces Gemini to format output variables to exact primitives, matching expected frontend components.

## Alternatives
- **Raw Prompting + Post-Processing Parse Loops**: Rejected. Wastes input/output tokens, causes latency with regex search/retry loops, and remains highly prone to runtime parsing failures.
- **Third-Party Wrappers**: Rejected. Introducing libraries (like LangChain or Instructor) adds dependency footprint and cold-start overhead when the native SDK already supports schema enforcement.

## Trade-offs
Enforcing a response schema constrains Gemini’s text generation structure and prevents conversational flexibility. However, for metadata extraction pipelines, output predictability and absolute parsing reliability are far more critical than creative style.
