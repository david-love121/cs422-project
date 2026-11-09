import { RUNTIME_RANGES, RATING_VALUES, YEAR_VALUES } from "./catalog";

export type Genre = { id: number; name: string };
export type Language = {
  iso_639_1: string;
  english_name: string;
  name: string;
};
export type Provider = {
  provider_id: number;
  provider_name: string;
  logo_path: string | null;
  display_priority?: number;
};
export type Movie = {
  id: number;
  title: string;
  overview: string;
  poster_path: string | null;
  backdrop_path: string | null;
  release_date: string;
  vote_average: number;
  vote_count: number;
  popularity: number;
  genre_ids: number[];
  original_language: string;
  runtime?: number;
  provider_ids?: number[];
};
export type CatalogMode = "demo" | "live";
export type Catalog = {
  mode: CatalogMode;
  genres: Genre[];
  languages: Language[];
  providers: Provider[];
};
export type Filters = {
  genres: number[];
  genreMode: "any" | "all";
  language: string;
  runtime: string;
  year: string;
  rating: string;
  sort: string;
  providers: number[];
};
export type MoviePage = {
  results: Movie[];
  total_results: number;
  total_pages: number;
  page: number;
};
export const DEFAULT_FILTERS: Filters = {
  genres: [],
  genreMode: "any",
  language: "",
  runtime: "",
  year: "",
  rating: "",
  sort: "popularity.desc",
  providers: [],
};
const API_BASE = "https://api.themoviedb.org/3";
export const MOVIE_SORTS = [
  "popularity.desc",
  "popularity.asc",
  "vote_average.desc",
  "vote_average.asc",
  "primary_release_date.desc",
  "primary_release_date.asc",
  "title.asc",
  "title.desc",
  "vote_count.desc",
  "vote_count.asc",
] as const;
const SORTS = new Set<string>(MOVIE_SORTS);

/** Shared by the sample catalog and live server so filter boundaries agree. */
export function filterBounds(filters: Filters) {
  const today = new Date().toISOString().slice(0, 10);
  let fromDate: string | undefined;
  let toDate = today;
  if (filters.year === "classic") toDate = "1989-12-31";
  else if (YEAR_VALUES.some((year) => year === filters.year && /^\d{4}$/.test(year))) {
    fromDate = `${filters.year}-01-01`;
    toDate = [`${Number(filters.year) + 9}-12-31`, today].sort()[0];
  }
  return {
    fromDate,
    toDate,
    runtime: RUNTIME_RANGES[filters.runtime],
    rating: RATING_VALUES.some((rating) => rating === filters.rating && rating !== "")
      ? Number(filters.rating)
      : 0,
    sort: SORTS.has(filters.sort) ? filters.sort : DEFAULT_FILTERS.sort,
  };
}

export function buildDiscoverUrl(filters: Filters, page = 1): string {
  const bounds = filterBounds(filters);
  const url = new URL(`${API_BASE}/discover/movie`);
  const params = url.searchParams;
  params.set("language", "en-US");
  params.set("include_adult", "false");
  params.set("include_video", "false");
  params.set("vote_count.gte", "100");
  params.set("sort_by", bounds.sort);
  params.set(
    "page",
    String(
      Number.isFinite(page) ? Math.min(500, Math.max(1, Math.floor(page))) : 1,
    ),
  );
  params.set("primary_release_date.lte", bounds.toDate);
  if (bounds.fromDate) params.set("primary_release_date.gte", bounds.fromDate);
  const genres = [...new Set(filters.genres)]
    .filter((id) => Number.isInteger(id) && id > 0)
    .sort((a, b) => a - b);
  if (genres.length)
    params.set(
      "with_genres",
      genres.join(filters.genreMode === "all" ? "," : "|"),
    );
  if (filters.language) params.set("with_original_language", filters.language);
  if (bounds.runtime) {
    params.set("with_runtime.gte", String(bounds.runtime[0]));
    if (bounds.runtime[1] !== undefined)
      params.set("with_runtime.lte", String(bounds.runtime[1]));
  }
  if (bounds.rating) params.set("vote_average.gte", String(bounds.rating));
  const providers = [...new Set(filters.providers ?? [])]
    .filter((id) => Number.isInteger(id) && id > 0)
    .sort((a, b) => a - b);
  if (providers.length) {
    params.set("with_watch_providers", providers.join("|"));
    params.set("watch_region", "US");
    params.set("with_watch_monetization_types", "flatrate|free|ads");
  }
  return url.toString();
}

export function imageUrl(
  path: string | null | undefined,
  size: "w500" | "w780" | "original" = "w500",
): string | undefined {
  if (!path || !/^\/[a-zA-Z0-9._-]+$/.test(path)) return undefined;
  return `https://image.tmdb.org/t/p/${size}${path}`;
}
