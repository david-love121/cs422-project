import type { Movie } from "./tmdb";

const positiveId = (value: unknown): value is number =>
  typeof value === "number" && Number.isSafeInteger(value) && value > 0;

function ids(value: unknown): number[] {
  return Array.isArray(value) ? [...new Set(value.filter(positiveId))] : [];
}

function imagePath(value: unknown): string | null {
  return typeof value === "string" && /^\/[a-zA-Z0-9._-]+$/.test(value)
    ? value
    : null;
}

function finiteNumber(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? value
    : fallback;
}

/** Recover useful saved metadata without trusting old browser-storage shapes. */
export function parseMovie(value: unknown): Movie | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const item = value as Record<string, unknown>;
  if (
    !positiveId(item.id) ||
    typeof item.title !== "string" ||
    !item.title.trim()
  )
    return null;

  const rating = finiteNumber(item.vote_average);
  const movie: Movie = {
    id: item.id,
    title: item.title.trim(),
    overview: typeof item.overview === "string" ? item.overview : "",
    poster_path: imagePath(item.poster_path),
    backdrop_path: imagePath(item.backdrop_path),
    release_date:
      typeof item.release_date === "string" &&
      /^\d{4}-\d{2}-\d{2}$/.test(item.release_date)
        ? item.release_date
        : "",
    vote_average: rating <= 10 ? rating : 0,
    vote_count:
      typeof item.vote_count === "number" &&
      Number.isSafeInteger(item.vote_count) &&
      item.vote_count >= 0
        ? item.vote_count
        : 0,
    popularity: finiteNumber(item.popularity),
    genre_ids: ids(item.genre_ids),
    original_language:
      typeof item.original_language === "string" &&
      /^[a-z]{2}$/.test(item.original_language)
        ? item.original_language
        : "",
  };
  if (
    typeof item.runtime === "number" &&
    Number.isFinite(item.runtime) &&
    item.runtime > 0
  )
    movie.runtime = item.runtime;
  if (Array.isArray(item.provider_ids)) movie.provider_ids = ids(item.provider_ids);
  return movie;
}

/** Keep every valid saved title, once per ID, without an undocumented limit. */
export function parseSavedMovies(value: unknown): Movie[] {
  if (!Array.isArray(value)) return [];
  const movies: Movie[] = [];
  const seen = new Set<number>();
  for (const item of value) {
    const movie = parseMovie(item);
    if (movie && !seen.has(movie.id)) {
      movies.push(movie);
      seen.add(movie.id);
    }
  }
  return movies;
}
