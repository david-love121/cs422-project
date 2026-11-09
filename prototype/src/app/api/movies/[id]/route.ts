import { movieService } from "@/lib/server/tmdb-service";
import {
  CACHE_SECONDS,
  errorResponse,
  parseCatalogMode,
  parseMovieId,
  requireNoQuery,
  sharedCacheHeaders,
} from "@/lib/server/query";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { mode, search } = parseCatalogMode(new URL(request.url).searchParams);
    requireNoQuery(search);
    const id = parseMovieId((await context.params).id);
    return Response.json(await movieService(mode).details(id), {
      headers: sharedCacheHeaders(CACHE_SECONDS.details),
    });
  } catch (error) {
    return errorResponse(error);
  }
}
