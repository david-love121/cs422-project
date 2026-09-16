import { movieService } from "@/lib/server/tmdb-service";
import {
  CACHE_SECONDS,
  errorResponse,
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
    requireNoQuery(new URL(request.url).searchParams);
    const id = parseMovieId((await context.params).id);
    return Response.json(await movieService().details(id), {
      headers: sharedCacheHeaders(CACHE_SECONDS.details),
    });
  } catch (error) {
    return errorResponse(error);
  }
}
