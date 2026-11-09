import {
  GENRE_MODES,
  MAX_FILTER_IDS,
  RATING_VALUES,
  RUNTIME_VALUES,
  YEAR_VALUES,
} from "../catalog";
import {
  DEFAULT_FILTERS,
  MOVIE_SORTS,
  type CatalogMode,
  type Filters,
} from "../tmdb";

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export const CACHE_SECONDS = {
  landing: 15 * 60,
  filtered: 5 * 60,
  catalog: 24 * 60 * 60,
  details: 6 * 60 * 60,
} as const;

const ALLOWED_KEYS = new Set([
  "genres",
  "genreMode",
  "language",
  "runtime",
  "year",
  "rating",
  "sort",
  "providers",
  "page",
]);
const SORTS = new Set<string>(MOVIE_SORTS);
const MAX_ID = 2_147_483_647;

function invalid(name: string): never {
  throw new ApiError(`Invalid ${name} filter.`, 400);
}

function ids(value: string, name: string): number[] {
  if (!value) return [];
  const parts = value.split(",");
  if (parts.length > MAX_FILTER_IDS) invalid(name);
  const numbers = parts.map((part) => {
    if (!/^[1-9]\d{0,9}$/.test(part)) invalid(name);
    const id = Number(part);
    if (id > MAX_ID) invalid(name);
    return id;
  });
  return [...new Set(numbers)].sort((a, b) => a - b);
}

function choice(
  value: string,
  options: readonly string[],
  name: string,
): string {
  if (!options.includes(value)) invalid(name);
  return value;
}

/** Consume the optional mode independently of each endpoint's remaining query. */
export function parseCatalogMode(search: URLSearchParams): {
  mode: CatalogMode | undefined;
  search: URLSearchParams;
} {
  const remaining = new URLSearchParams(search);
  const modes = remaining.getAll("mode");
  if (
    modes.length > 1 ||
    (modes.length === 1 && !["demo", "live"].includes(modes[0]))
  )
    throw new ApiError("Invalid catalog mode.", 400);
  remaining.delete("mode");
  return { mode: modes[0] as CatalogMode | undefined, search: remaining };
}

export function parseMovieQuery(search: URLSearchParams): {
  filters: Filters;
  page: number;
} {
  if (search.toString().length > 2_048)
    throw new ApiError("Too many filter options.", 400);
  for (const key of search.keys()) {
    if (!ALLOWED_KEYS.has(key))
      throw new ApiError("Unknown filter option.", 400);
    if (search.getAll(key).length !== 1)
      throw new ApiError("Repeated filter option.", 400);
  }
  const language = search.get("language") ?? "";
  if (language && !/^[a-z]{2}$/.test(language)) invalid("language");
  const sort = search.get("sort") ?? DEFAULT_FILTERS.sort;
  if (!SORTS.has(sort)) invalid("sort");
  const pageText = search.get("page") ?? "1";
  if (!/^[1-9]\d{0,2}$/.test(pageText) || Number(pageText) > 500)
    invalid("page");
  return {
    filters: {
      genres: ids(search.get("genres") ?? "", "genres"),
      genreMode: choice(
        search.get("genreMode") ?? "any",
        GENRE_MODES,
        "genre mode",
      ) as "any" | "all",
      language,
      runtime: choice(
        search.get("runtime") ?? "",
        RUNTIME_VALUES,
        "runtime",
      ),
      year: choice(
        search.get("year") ?? "",
        YEAR_VALUES,
        "year",
      ),
      rating: choice(search.get("rating") ?? "", RATING_VALUES, "rating"),
      sort,
      providers: ids(search.get("providers") ?? "", "providers"),
    },
    page: Number(pageText),
  };
}

export function parseMovieId(value: string): number {
  if (!/^[1-9]\d{0,9}$/.test(value) || Number(value) > MAX_ID) {
    throw new ApiError("Invalid movie ID.", 400);
  }
  return Number(value);
}

export function requireNoQuery(search: URLSearchParams): void {
  if (search.size)
    throw new ApiError("This endpoint does not accept query parameters.", 400);
}

export function movieCacheSeconds(filters: Filters, page: number): number {
  const landing =
    page === 1 &&
    !filters.genres.length &&
    !filters.providers.length &&
    !filters.language &&
    !filters.runtime &&
    !filters.year &&
    !filters.rating &&
    filters.sort === DEFAULT_FILTERS.sort;
  return landing ? CACHE_SECONDS.landing : CACHE_SECONDS.filtered;
}

export function sharedCacheHeaders(seconds: number): Record<string, string> {
  const shared = `public, s-maxage=${seconds}, stale-while-revalidate=60`;
  return {
    "Cache-Control": `public, max-age=0, s-maxage=${seconds}, stale-while-revalidate=60`,
    "CDN-Cache-Control": shared,
    "Vercel-CDN-Cache-Control": shared,
    "X-Content-Type-Options": "nosniff",
  };
}

export function errorResponse(error: unknown): Response {
  const known = error instanceof ApiError;
  return Response.json(
    {
      error: known
        ? error.message
        : "The movie catalog is temporarily unavailable. Please try again.",
    },
    {
      status: known ? error.status : 500,
      headers: {
        "Cache-Control": "no-store",
        "CDN-Cache-Control": "no-store",
        "Vercel-CDN-Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      },
    },
  );
}
