import { movieService } from "@/lib/server/tmdb-service";
import {
  CACHE_SECONDS,
  errorResponse,
  requireNoQuery,
  sharedCacheHeaders,
} from "@/lib/server/query";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    requireNoQuery(new URL(request.url).searchParams);
    return Response.json(await movieService().catalog(), {
      headers: sharedCacheHeaders(CACHE_SECONDS.catalog),
    });
  } catch (error) {
    return errorResponse(error);
  }
}
