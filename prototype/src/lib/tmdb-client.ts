import {
  DEFAULT_FILTERS,
  type Catalog,
  type CatalogMode,
  type Filters,
  type Movie,
  type MoviePage,
} from "./tmdb";
export type { Catalog } from "./tmdb";

/** Browser requests only our own application; TMDB credentials stay on the server. */
async function request<T>(path: string, signal?: AbortSignal): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, {
      headers: { Accept: "application/json" },
      signal,
      credentials: "same-origin",
    });
  } catch (error) {
    if (
      signal?.aborted ||
      (error instanceof Error && error.name === "AbortError")
    )
      throw error;
    throw new Error(
      "Couldn’t reach the movie collection. Check your connection and try again.",
    );
  }

  let data: unknown;
  try {
    data = await response.json();
  } catch (error) {
    if (
      signal?.aborted ||
      (error instanceof Error && error.name === "AbortError")
    )
      throw error;
    throw new Error(
      "The movie collection is temporarily unavailable. Please try again.",
    );
  }
  if (!response.ok) {
    const message =
      typeof data === "object" &&
      data !== null &&
      "error" in data &&
      typeof data.error === "string"
        ? data.error
        : response.status === 429
          ? "A lot of movie nights are being planned. Please wait a moment and try again."
          : "Couldn’t load the movie collection. Please try again.";
    throw new Error(message);
  }
  return data as T;
}

export async function fetchCatalog(
  signal?: AbortSignal,
  mode?: CatalogMode,
): Promise<Catalog> {
  const data = await request<Catalog>(
    `/api/catalog${mode ? `?mode=${mode}` : ""}`,
    signal,
  );
  if (
    !["live", "demo"].includes(data.mode) ||
    !Array.isArray(data.genres) ||
    !Array.isArray(data.languages) ||
    !Array.isArray(data.providers)
  )
    throw new Error("Couldn’t load movie preferences. Please try again.");
  return data;
}

export async function fetchMovies(
  filters: Filters,
  page = 1,
  signal?: AbortSignal,
  mode?: CatalogMode,
): Promise<MoviePage> {
  const params = new URLSearchParams();
  if (mode) params.set("mode", mode);
  const sortedIds = (ids: number[]) =>
    [...new Set(ids)].sort((a, b) => a - b).join(",");
  if (filters.genres.length) {
    params.set("genres", sortedIds(filters.genres));
    params.set("genreMode", filters.genreMode);
  }
  if (filters.language) params.set("language", filters.language);
  if (filters.runtime) params.set("runtime", filters.runtime);
  if (filters.year) params.set("year", filters.year);
  if (filters.rating) params.set("rating", filters.rating);
  if (filters.sort !== DEFAULT_FILTERS.sort) params.set("sort", filters.sort);
  if (filters.providers.length)
    params.set("providers", sortedIds(filters.providers));
  if (page !== 1) params.set("page", String(page));
  const query = params.toString();
  const data = await request<MoviePage>(
    `/api/movies${query ? `?${query}` : ""}`,
    signal,
  );
  if (!Array.isArray(data.results))
    throw new Error("Couldn’t load the movie list. Please try again.");
  return data;
}

export function fetchMovieDetails(
  id: number,
  signal?: AbortSignal,
  mode?: CatalogMode,
): Promise<Movie> {
  return request<Movie>(
    `/api/movies/${id}${mode ? `?mode=${mode}` : ""}`,
    signal,
  );
}
