import { movieService } from "@/lib/server/tmdb-service";
import {
  CACHE_SECONDS,
  errorResponse,
  parseCatalogMode,
  requireNoQuery,
  sharedCacheHeaders,
} from "@/lib/server/query";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const { mode, search } = parseCatalogMode(new URL(request.url).searchParams);
    requireNoQuery(search);
    return Response.json(await movieService(mode).catalog(), {
      headers: sharedCacheHeaders(CACHE_SECONDS.catalog),
    });
  } catch (error) {
    return errorResponse(error);
  }
}
