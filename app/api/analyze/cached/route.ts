import { NextResponse } from "next/server";
import { getCachedAnalysisByHash } from "../../../../lib/db/analysis-cache";

// GET /api/analyze/cached?hash=<sha256> — retrieve cached analysis by file content hash.
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const hash = searchParams.get("hash");

  if (!hash || !/^[0-9a-f]{64}$/i.test(hash)) {
    return NextResponse.json(
      { error: { code: "INVALID_REQUEST", message: "A valid 64-character SHA-256 hash is required." } },
      { status: 400 }
    );
  }

  const result = await getCachedAnalysisByHash(hash);

  if (!result.hit) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "No cached result found for this file. Please re-upload it." } },
      { status: 404 }
    );
  }

  return NextResponse.json({ data: result.data, cached: true });
}
