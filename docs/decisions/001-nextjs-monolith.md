# ADR 001: Next.js Monolith Architecture

## Status
Accepted

## Decision
Build the application as a single Next.js application using the App Router for both the frontend and backend API routes.

React, TypeScript, Tailwind CSS, shared validation schemas, and server-side integrations are maintained within one codebase and deployment unit.

## Reason
1. **Shared Types and Validation**: Zod schemas and TypeScript types can be reused across application boundaries, reducing duplication and contract mismatches.
2. **Simplified Deployment**: The frontend and API routes can be deployed together while keeping Gemini and database credentials server-side.
3. **Rapid Development**: A single codebase avoids additional CORS configuration, separate deployments, and local multi-service orchestration.

## Alternatives
- **Separate Frontend and Backend**: Not selected because the current application has a small API surface and does not require independent service scaling or deployment.
- **Standalone Serverless Functions**: Not selected because separate function infrastructure would add deployment and maintenance complexity without a clear benefit at the current scale.

## Trade-offs
The monolithic architecture couples frontend and API deployment and provides less flexibility for independently scaling document-processing workloads.

For the current workload and 48-hour development scope, simpler development, deployment, and maintenance outweigh the benefits of separate services. If analysis workloads grow significantly, document processing could later move to asynchronous workers while keeping Next.js as the web and API layer.