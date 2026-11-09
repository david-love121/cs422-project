import "server-only";

import {
  DEMO_GENRES,
  DEMO_LANGUAGES,
  DEMO_MOVIES,
  DEMO_PROVIDERS,
  filterDemoMovies,
} from "../demo";
import {
  buildDiscoverUrl,
  type Filters,
  type Genre,
  type Language,
  type Movie,
  type MoviePage,
  type Provider,
} from "../tmdb";
import { ApiError, CACHE_SECONDS, movieCacheSeconds } from "./query";

export type Catalog = {
  mode: "live" | "demo";
  genres: Genre[];
  languages: Language[];
  providers: Provider[];
};

type JsonObject = Record<string, unknown>;
type Fetcher = typeof fetch;

function object(value: unknown): JsonObject {
  if (!value || typeof value !== "object" || Array.isArray(value)) malformed();
  return value as JsonObject;
}

function malformed(): never {
  throw new ApiError(
    "The movie catalog returned an unexpected response. Please try again.",
    502,
  );
}

function array(value: unknown): unknown[] {
  if (!Array.isArray(value)) malformed();
  return value;
}

function text(value: unknown): string {
  if (typeof value !== "string") malformed();
  return value;
}

function number(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) malformed();
  return value;
}

function integer(value: unknown, min = 0): number {
  const parsed = number(value);
  if (!Number.isSafeInteger(parsed) || parsed < min) malformed();
  return parsed;
}

function imagePath(value: unknown): string | null {
  return typeof value === "string" && /^\/[a-zA-Z0-9._-]+$/.test(value)
    ? value
    : null;
}

function genre(value: unknown): Genre {
  const item = object(value);
  return { id: integer(item.id, 1), name: text(item.name) };
}

function movie(value: unknown, details = false): Movie {
  const item = object(value);
  const result: Movie = {
    id: integer(item.id, 1),
    title: text(item.title),
    overview: typeof item.overview === "string" ? item.overview : "",
    poster_path: imagePath(item.poster_path),
    backdrop_path: imagePath(item.backdrop_path),
    release_date:
      typeof item.release_date === "string" ? item.release_date : "",
    vote_average: number(item.vote_average),
    vote_count: integer(item.vote_count),
    popularity: number(item.popularity),
    original_language: text(item.original_language),
    genre_ids: details
      ? array(item.genres).map((value) => genre(value).id)
      : array(item.genre_ids).map((value) => integer(value, 1)),
  };
  if (details && typeof item.runtime === "number")
    result.runtime = integer(item.runtime);
  return result;
}

/** Injectable fetch makes the credential boundary and cache behavior testable without a real token. */
export function createMovieService({
  token,
  fetcher = fetch,
}: { token?: string; fetcher?: Fetcher } = {}) {
  const credential = token?.trim().replace(/^Bearer\s+/i, "") ?? "";
  const mode = credential ? "live" : "demo";

  async function request(endpoint: string, seconds: number): Promise<unknown> {
    // Endpoints are constructed inside this module, never taken from a visitor's URL.
    const url = new URL(endpoint, "https://api.themoviedb.org/3/");
    if (
      url.origin !== "https://api.themoviedb.org" ||
      !url.pathname.startsWith("/3/")
    ) {
      throw new ApiError(
        "The movie catalog is temporarily unavailable. Please try again.",
        500,
      );
    }
    const headers: Record<string, string> = { Accept: "application/json" };
    if (/^[a-f0-9]{32}$/i.test(credential))
      url.searchParams.set("api_key", credential);
    else headers.Authorization = `Bearer ${credential}`;
    try {
      const response = await fetcher(url.toString(), {
        headers,
        cache: "force-cache",
        next: { revalidate: seconds },
        signal: AbortSignal.timeout(10_000),
        redirect: "error",
      });
      if (response.status === 401 || response.status === 403) {
        throw new ApiError(
          "The live catalog is not configured correctly. Please contact the site owner.",
          503,
        );
      }
      if (response.status === 404)
        throw new ApiError(
          "This movie is no longer available in the catalog.",
          404,
        );
      if (response.status === 429)
        throw new ApiError(
          "The movie catalog is busy. Please wait a moment and try again.",
          503,
        );
      if (!response.ok)
        throw new ApiError(
          "The movie catalog is temporarily unavailable. Please try again.",
          502,
        );
      return await response.json();
    } catch (error) {
      if (error instanceof ApiError) throw error;
      if (
        error instanceof Error &&
        (error.name === "TimeoutError" || error.name === "AbortError")
      ) {
        throw new ApiError(
          "The movie catalog took too long to respond. Please try again.",
          504,
        );
      }
      throw new ApiError(
        "Could not reach the movie catalog. Please try again.",
        502,
      );
    }
  }

  return {
    async catalog(): Promise<Catalog> {
      if (mode === "demo")
        return {
          mode,
          genres: DEMO_GENRES,
          languages: DEMO_LANGUAGES,
          providers: DEMO_PROVIDERS,
        };
      const [genresData, languagesData, providersData] = await Promise.all([
        request("genre/movie/list?language=en-US", CACHE_SECONDS.catalog),
        request("configuration/languages", CACHE_SECONDS.catalog),
        request(
          "watch/providers/movie?watch_region=US&language=en-US",
          CACHE_SECONDS.catalog,
        ),
      ]);
      const genres = array(object(genresData).genres).map(genre);
      const languages = array(languagesData)
        .map((value): Language => {
          const item = object(value);
          return {
            iso_639_1: text(item.iso_639_1),
            english_name: text(item.english_name),
            name: text(item.name),
          };
        })
        .filter(
          (value) => /^[a-z]{2}$/.test(value.iso_639_1) && value.english_name,
        )
        .sort((a, b) => a.english_name.localeCompare(b.english_name));
      const providers = array(object(providersData).results)
        .map((value): Provider => {
          const item = object(value);
          return {
            provider_id: integer(item.provider_id, 1),
            provider_name: text(item.provider_name),
            logo_path: imagePath(item.logo_path),
            display_priority:
              typeof item.display_priority === "number"
                ? integer(item.display_priority)
                : 9999,
          };
        })
        .sort(
          (a, b) =>
            (a.display_priority ?? 9999) - (b.display_priority ?? 9999) ||
            a.provider_name.localeCompare(b.provider_name),
        );
      return { mode, genres, languages, providers };
    },

    async movies(filters: Filters, page: number): Promise<MoviePage> {
      if (mode === "demo") {
        const matches = filterDemoMovies(filters);
        return {
          results: matches.slice((page - 1) * 20, page * 20),
          page,
          total_results: matches.length,
          total_pages: Math.ceil(matches.length / 20),
        };
      }
      const data = object(
        await request(
          buildDiscoverUrl(filters, page),
          movieCacheSeconds(filters, page),
        ),
      );
      return {
        results: array(data.results).map((value) => movie(value)),
        page: integer(data.page, 1),
        total_pages: Math.min(500, integer(data.total_pages)),
        total_results: integer(data.total_results),
      };
    },

    async details(id: number): Promise<Movie> {
      if (mode === "demo") {
        const result = DEMO_MOVIES.find((item) => item.id === id);
        if (!result)
          throw new ApiError(
            "This movie is not available in the sample catalog.",
            404,
          );
        return result;
      }
      return movie(
        await request(`movie/${id}?language=en-US`, CACHE_SECONDS.details),
        true,
      );
    },
  };
}

export function movieService() {
  return createMovieService({ token: process.env.TMDB_API_TOKEN });
}
