import { movieService } from "@/lib/server/tmdb-service";
import {
  errorResponse,
  movieCacheSeconds,
  parseCatalogMode,
  parseMovieQuery,
  sharedCacheHeaders,
} from "@/lib/server/query";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const { mode, search } = parseCatalogMode(new URL(request.url).searchParams);
    const { filters, page } = parseMovieQuery(search);
    return Response.json(await movieService(mode).movies(filters, page), {
      headers: sharedCacheHeaders(movieCacheSeconds(filters, page)),
    });
  } catch (error) {
    return errorResponse(error);
  }
}
