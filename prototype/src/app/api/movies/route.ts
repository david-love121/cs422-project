import { movieService } from "@/lib/server/tmdb-service";
import {
  errorResponse,
  movieCacheSeconds,
  parseMovieQuery,
  sharedCacheHeaders,
} from "@/lib/server/query";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const { filters, page } = parseMovieQuery(
      new URL(request.url).searchParams,
    );
    return Response.json(await movieService().movies(filters, page), {
      headers: sharedCacheHeaders(movieCacheSeconds(filters, page)),
    });
  } catch (error) {
    return errorResponse(error);
  }
}
