# ADR 002: Layered SSRF Protection

## Status
Accepted

## Decision
Implement layered validation for user-provided URLs before server-side document fetching.

The application:
- allows only HTTP and HTTPS protocols;
- rejects URLs containing embedded credentials;
- resolves hostnames and rejects private, loopback, link-local, multicast, and other non-public IPv4/IPv6 addresses;
- disables automatic redirects;
- validates every redirect destination through the same security pipeline;
- limits redirect chains to 5 hops.

The validation logic is isolated in `lib/security/validate-url.ts`, while safe fetching and redirect handling are implemented in `lib/pdf/fetch-pdf.ts`.

## Reason
1. **Network Boundary Security**: Fetching user-controlled URLs creates an SSRF risk that could expose internal services, private networks, or cloud metadata endpoints.
2. **Layered Protection**: Protocol restrictions, IP validation, and redirect revalidation address multiple common SSRF attack paths rather than relying only on hostname checks.

## Alternatives
- **Basic Hostname Checking**: Rejected because hostname-only validation does not protect against redirects or hostnames resolving to non-public addresses.
- **Client-side Fetching**: Rejected because browser CORS restrictions would prevent reliable access to many external PDF sources.

## Trade-offs
DNS resolution and manual redirect handling add latency and implementation complexity. This is accepted because server-side URL fetching crosses an important trust boundary.

A stronger production deployment could additionally enforce outbound network restrictions and DNS-resolution pinning to reduce DNS rebinding and time-of-check/time-of-use risks.