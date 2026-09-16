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
const RUNTIMES: Record<string, [number, number?]> = {
  short: [1, 90],
  medium: [91, 120],
  long: [121, 180],
  epic: [181],
};
const SORTS = new Set([
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
]);

/** Shared by the sample catalog and live client so filter boundaries agree. */
export function filterBounds(filters: Filters) {
  const today = new Date().toISOString().slice(0, 10);
  let fromDate: string | undefined;
  let toDate = today;
  if (filters.year === "classic") toDate = "1989-12-31";
  else if (["2020", "2010", "2000", "1990"].includes(filters.year)) {
    fromDate = `${filters.year}-01-01`;
    toDate = [`${Number(filters.year) + 9}-12-31`, today].sort()[0];
  }
  return {
    fromDate,
    toDate,
    runtime: RUNTIMES[filters.runtime],
    rating: ["6", "7", "8"].includes(filters.rating)
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
  const genres = [...new Set(filters.genres)].filter(
    (id) => Number.isInteger(id) && id > 0,
  );
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
  const providers = [...new Set(filters.providers ?? [])].filter(
    (id) => Number.isInteger(id) && id > 0,
  );
  if (providers.length) {
    params.set("with_watch_providers", providers.join("|"));
    params.set("watch_region", "US");
    params.set("with_watch_monetization_types", "flatrate|free|ads");
  }
  return url.toString();
}

/** Called from client components: the device connects directly to TMDB. */
async function request<T>(
  token: string,
  endpoint: string,
  signal?: AbortSignal,
): Promise<T> {
  const credential = token.trim().replace(/^Bearer\s+/i, "");
  if (!credential)
    throw new Error(
      "Add your TMDB read access token to connect to the live catalog.",
    );
  const url = new URL(
    endpoint.startsWith("https://") ? endpoint : `${API_BASE}${endpoint}`,
  );
  const headers: HeadersInit = { Accept: "application/json" };
  if (/^[a-f0-9]{32}$/i.test(credential))
    url.searchParams.set("api_key", credential);
  else headers.Authorization = `Bearer ${credential}`;
  let response: Response;
  try {
    response = await fetch(url.toString(), {
      headers,
      signal,
      credentials: "omit",
    });
  } catch (error) {
    if (
      signal?.aborted ||
      (error instanceof Error && error.name === "AbortError")
    )
      throw error;
    throw new Error(
      "Could not reach TMDB. Check your internet connection and try again.",
    );
  }
  if (!response.ok) {
    if (response.status === 401 || response.status === 403)
      throw new Error(
        "TMDB did not accept that credential. Check your API read access token or API key.",
      );
    if (response.status === 404)
      throw new Error("This item is no longer available in the TMDB catalog.");
    if (response.status === 429)
      throw new Error(
        "TMDB is receiving too many requests. Wait a moment and try again.",
      );
    if (response.status >= 500)
      throw new Error(
        "TMDB is temporarily unavailable. Please try again in a moment.",
      );
    throw new Error(
      `TMDB could not complete this request (HTTP ${response.status}). Try adjusting your filters.`,
    );
  }
  try {
    return (await response.json()) as T;
  } catch (error) {
    if (
      signal?.aborted ||
      (error instanceof Error && error.name === "AbortError")
    )
      throw error;
    throw new Error("TMDB returned an unreadable response. Please try again.");
  }
}

export async function fetchMovies(
  token: string,
  filters: Filters,
  page = 1,
  signal?: AbortSignal,
): Promise<MoviePage> {
  const data = await request<MoviePage>(
    token,
    buildDiscoverUrl(filters, page),
    signal,
  );
  if (!Array.isArray(data.results))
    throw new Error(
      "TMDB returned an unexpected movie list. Please try again.",
    );
  return { ...data, total_pages: Math.min(500, data.total_pages) };
}

export async function fetchMetadata(
  token: string,
  signal?: AbortSignal,
): Promise<{ genres: Genre[]; languages: Language[] }> {
  const [data, languages] = await Promise.all([
    request<{ genres: Genre[] }>(
      token,
      "/genre/movie/list?language=en-US",
      signal,
    ),
    request<Language[]>(token, "/configuration/languages", signal),
  ]);
  if (!Array.isArray(data.genres) || !Array.isArray(languages))
    throw new Error(
      "TMDB returned unexpected filter options. Please try again.",
    );
  return {
    genres: data.genres,
    languages: languages
      .filter((language) => language.iso_639_1 && language.english_name)
      .sort((a, b) => a.english_name.localeCompare(b.english_name)),
  };
}

export async function fetchProviders(
  token: string,
  signal?: AbortSignal,
): Promise<Provider[]> {
  const data = await request<{ results: Provider[] }>(
    token,
    "/watch/providers/movie?watch_region=US&language=en-US",
    signal,
  );
  if (!Array.isArray(data.results))
    throw new Error(
      "TMDB returned unexpected streaming services. Please try again.",
    );
  return data.results.sort(
    (a, b) =>
      (a.display_priority ?? 9999) - (b.display_priority ?? 9999) ||
      a.provider_name.localeCompare(b.provider_name),
  );
}

export async function fetchMovieDetails(
  token: string,
  id: number,
  signal?: AbortSignal,
): Promise<Movie> {
  if (!Number.isInteger(id) || id <= 0)
    throw new Error("That movie could not be found.");
  const data = await request<Movie & { genres: Genre[] }>(
    token,
    `/movie/${id}?language=en-US`,
    signal,
  );
  return { ...data, genre_ids: data.genres?.map((genre) => genre.id) ?? [] };
}

export function imageUrl(
  path: string | null | undefined,
  size: "w500" | "w780" | "original" = "w500",
): string | undefined {
  if (!path || !/^\/[a-zA-Z0-9._-]+$/.test(path)) return undefined;
  return `https://image.tmdb.org/t/p/${size}${path}`;
}
