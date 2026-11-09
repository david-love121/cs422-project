import {
  filterBounds,
  type Filters,
  type Genre,
  type Language,
  type Movie,
  type Provider,
} from "./tmdb";
import studyCatalog from "./study-catalog.json";

/** Prepared TMDB metadata and US listings, retrieved 2026-11-09. Playback access must be rechecked by the group. */
export const DEMO_GENRES: Genre[] = [
  { id: 28, name: "Action" },
  { id: 12, name: "Adventure" },
  { id: 16, name: "Animation" },
  { id: 35, name: "Comedy" },
  { id: 80, name: "Crime" },
  { id: 99, name: "Documentary" },
  { id: 18, name: "Drama" },
  { id: 10751, name: "Family" },
  { id: 14, name: "Fantasy" },
  { id: 36, name: "History" },
  { id: 27, name: "Horror" },
  { id: 10402, name: "Music" },
  { id: 9648, name: "Mystery" },
  { id: 10749, name: "Romance" },
  { id: 878, name: "Science Fiction" },
  { id: 10770, name: "TV Movie" },
  { id: 53, name: "Thriller" },
  { id: 10752, name: "War" },
  { id: 37, name: "Western" },
];
export const DEMO_LANGUAGES: Language[] = [
  { iso_639_1: "en", english_name: "English", name: "English" },
  { iso_639_1: "fr", english_name: "French", name: "Français" },
  { iso_639_1: "de", english_name: "German", name: "Deutsch" },
  { iso_639_1: "hi", english_name: "Hindi", name: "हिन्दी" },
  { iso_639_1: "ta", english_name: "Tamil", name: "தமிழ்" },
  { iso_639_1: "it", english_name: "Italian", name: "Italiano" },
  { iso_639_1: "ja", english_name: "Japanese", name: "日本語" },
  { iso_639_1: "ko", english_name: "Korean", name: "한국어" },
  { iso_639_1: "pt", english_name: "Portuguese", name: "Português" },
  { iso_639_1: "es", english_name: "Spanish", name: "Español" },
];
export const DEMO_PROVIDERS: Provider[] = studyCatalog.providers;
export const CATALOG_SNAPSHOT_DATE = studyCatalog.retrieved_at;
export const DEMO_MOVIES: Movie[] = studyCatalog.movies;

export function filterDemoMovies(filters: Filters): Movie[] {
  const bounds = filterBounds(filters);
  const genres = [...new Set(filters.genres)].filter(
    (id) => Number.isInteger(id) && id > 0,
  );
  const providers = [...new Set(filters.providers ?? [])].filter(
    (id) => Number.isInteger(id) && id > 0,
  );
  const matches = DEMO_MOVIES.filter((movie) => {
    if (genres.length) {
      const hasGenre = (id: number) => movie.genre_ids.includes(id);
      if (
        !(filters.genreMode === "all"
          ? genres.every(hasGenre)
          : genres.some(hasGenre))
      )
        return false;
    }
    if (
      providers.length &&
      !providers.some((id) => movie.provider_ids?.includes(id))
    )
      return false;
    if (filters.language && movie.original_language !== filters.language)
      return false;
    if (
      bounds.runtime &&
      (!movie.runtime ||
        movie.runtime < bounds.runtime[0] ||
        (bounds.runtime[1] !== undefined && movie.runtime > bounds.runtime[1]))
    )
      return false;
    if (bounds.fromDate && movie.release_date < bounds.fromDate) return false;
    if (!movie.release_date || movie.release_date > bounds.toDate) return false;
    return movie.vote_average >= bounds.rating && movie.vote_count >= 100;
  });
  const [sortBy, direction] = bounds.sort.split(".");
  const multiplier = direction === "asc" ? 1 : -1;
  return matches.sort((a, b) => {
    let value = 0;
    if (sortBy === "primary_release_date")
      value = a.release_date.localeCompare(b.release_date);
    else if (sortBy === "title") value = a.title.localeCompare(b.title);
    else if (sortBy === "vote_average") value = a.vote_average - b.vote_average;
    else if (sortBy === "vote_count") value = a.vote_count - b.vote_count;
    else value = a.popularity - b.popularity;
    return value * multiplier || a.title.localeCompare(b.title);
  });
}
