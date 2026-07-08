import { NextResponse } from "next/server";
import { getClientIp, hashIp } from "../../../lib/security/rate-limit";
import { getSearchHistory } from "../../../lib/db/search-history";
import { mapErrorToResponse } from "../../../lib/errors/error-response";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const pageParam = url.searchParams.get("page") || "1";
  const pageSizeParam = url.searchParams.get("pageSize") || "3";

  const page = Math.max(1, parseInt(pageParam, 10));
  const pageSize = Math.max(1, parseInt(pageSizeParam, 10));

  try {
    const ip = getClientIp(request);
    const ipHash = hashIp(ip);

    const { items, totalCount } = await getSearchHistory(ipHash, page, pageSize);

    return NextResponse.json({
      items,
      totalCount,
      page,
      pageSize,
    });
  } catch (error) {
    return mapErrorToResponse(error, "history_route_error");
  }
}
