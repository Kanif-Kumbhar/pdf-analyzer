import { NextResponse } from "next/server";
import { getRateLimitStatus } from "../../../lib/security/rate-limit";

export async function GET(request: Request) {
  try {
    const status = await getRateLimitStatus(request);
    return NextResponse.json(status);
  } catch (error) {
    return NextResponse.json(
      {
        requestRemaining: 100,
        requestMax: 100,
        analysisRemaining: 10,
        analysisMax: 10,
        analysisResetSeconds: 0,
      },
      { status: 200 }
    );
  }
}
