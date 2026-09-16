import {
  filterBounds,
  type Filters,
  type Genre,
  type Language,
  type Movie,
  type Provider,
} from "./tmdb";

/** Curated demo metadata. Ratings are snapshots; US streaming availability is illustrative, not a current availability claim. */
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
  { iso_639_1: "it", english_name: "Italian", name: "Italiano" },
  { iso_639_1: "ja", english_name: "Japanese", name: "日本語" },
  { iso_639_1: "ko", english_name: "Korean", name: "한국어" },
  { iso_639_1: "pt", english_name: "Portuguese", name: "Português" },
  { iso_639_1: "es", english_name: "Spanish", name: "Español" },
];
export const DEMO_PROVIDERS: Provider[] = [
  {
    provider_id: 8,
    provider_name: "Netflix",
    logo_path: null,
    display_priority: 0,
  },
  {
    provider_id: 9,
    provider_name: "Amazon Prime Video",
    logo_path: null,
    display_priority: 1,
  },
  {
    provider_id: 337,
    provider_name: "Disney Plus",
    logo_path: null,
    display_priority: 2,
  },
  {
    provider_id: 15,
    provider_name: "Hulu",
    logo_path: null,
    display_priority: 3,
  },
  {
    provider_id: 350,
    provider_name: "Apple TV+",
    logo_path: null,
    display_priority: 4,
  },
];
export const DEMO_MOVIES: Movie[] = [
  {
    id: 508442,
    title: "Soul",
    release_date: "2020-12-25",
    runtime: 101,
    original_language: "en",
    genre_ids: [16, 10751, 35, 14],
    vote_average: 8.1,
    vote_count: 10500,
    popularity: 100,
    poster_path: "/hm58Jw4Lw8OIeECIq5qyPYhAeRJ.jpg",
    backdrop_path: "/kf456ZqeC45XTvo6W9pW5clYKfQ.jpg",
    provider_ids: [337],
    overview:
      "A New York jazz pianist finds himself in an extraordinary place where new souls discover their personalities, and begins to rethink what makes a life worth living.",
  },
  {
    id: 157336,
    title: "Interstellar",
    release_date: "2014-11-05",
    runtime: 169,
    original_language: "en",
    genre_ids: [12, 18, 878],
    vote_average: 8.4,
    vote_count: 36000,
    popularity: 98,
    poster_path: "/gEU2QniE6E77NI6lCU6MxlNBvIx.jpg",
    backdrop_path: "/xJHokMbljvjADYdit5fK5VQsXEG.jpg",
    provider_ids: [9, 8],
    overview:
      "A pilot joins a team of explorers on a journey beyond our solar system, searching for a new home for humanity and a way back to his family.",
  },
  {
    id: 120467,
    title: "The Grand Budapest Hotel",
    release_date: "2014-02-26",
    runtime: 100,
    original_language: "en",
    genre_ids: [35, 18],
    vote_average: 8.1,
    vote_count: 14000,
    popularity: 92,
    poster_path: "/eWdyYQreja6JGCzqHWXpWHDrrPo.jpg",
    backdrop_path: null,
    provider_ids: [15, 337],
    overview:
      "A devoted concierge and his young lobby boy become entangled in a stolen painting, a family fortune, and a madcap adventure across a changing Europe.",
  },
  {
    id: 129,
    title: "Spirited Away",
    release_date: "2001-07-20",
    runtime: 125,
    original_language: "ja",
    genre_ids: [16, 10751, 14],
    vote_average: 8.5,
    vote_count: 16500,
    popularity: 89,
    poster_path: "/39wmItIWsg5sZMyRUHLkWBcuVCM.jpg",
    backdrop_path: null,
    provider_ids: [8],
    overview:
      "When her parents are transformed in a mysterious spirit world, a young girl finds courage, friendship, and a job in an extraordinary bathhouse.",
  },
  {
    id: 496243,
    title: "Parasite",
    release_date: "2019-05-30",
    runtime: 132,
    original_language: "ko",
    genre_ids: [35, 53, 18],
    vote_average: 8.5,
    vote_count: 17500,
    popularity: 87,
    poster_path: "/7IiTTgloJzvGI1TAYymCfbfl3vT.jpg",
    backdrop_path: null,
    provider_ids: [15, 9],
    overview:
      "An inventive family gradually finds work in a wealthy household, setting off a darkly funny chain of events that neither family can control.",
  },
  {
    id: 693134,
    title: "Dune: Part Two",
    release_date: "2024-02-27",
    runtime: 167,
    original_language: "en",
    genre_ids: [878, 12],
    vote_average: 8.2,
    vote_count: 6500,
    popularity: 85,
    poster_path: "/1pdfLvkbY9ohJlCjQH2CZjjYVvJ.jpg",
    backdrop_path: null,
    provider_ids: [9],
    overview:
      "Paul Atreides joins Chani and the Fremen as he navigates an impossible choice between love, revenge, and the fate of the known universe.",
  },
  {
    id: 194,
    title: "Amélie",
    release_date: "2001-04-25",
    runtime: 122,
    original_language: "fr",
    genre_ids: [35, 10749],
    vote_average: 7.9,
    vote_count: 11500,
    popularity: 82,
    poster_path: "/nSxDa3M9aMvGVLoItzWTepQ5h5d.jpg",
    backdrop_path: null,
    provider_ids: [350, 9],
    overview:
      "A shy Parisian waitress starts quietly improving the lives of the people around her, discovering that her own happiness might require a little courage.",
  },
  {
    id: 545611,
    title: "Everything Everywhere All at Once",
    release_date: "2022-03-24",
    runtime: 139,
    original_language: "en",
    genre_ids: [28, 12, 878],
    vote_average: 7.8,
    vote_count: 6800,
    popularity: 80,
    poster_path: "/w3LxiVYdWWRvEVdn5RYq6jIqkb1.jpg",
    backdrop_path: null,
    provider_ids: [8, 9],
    overview:
      "A laundromat owner facing a tax audit is swept into a multiverse adventure, where saving the world begins with understanding her family.",
  },
  {
    id: 120,
    title: "The Lord of the Rings: The Fellowship of the Ring",
    release_date: "2001-12-18",
    runtime: 179,
    original_language: "en",
    genre_ids: [12, 14, 28],
    vote_average: 8.4,
    vote_count: 25000,
    popularity: 79,
    poster_path: "/6oom5QYQ2yQTMJIbnvbkBL9cHo6.jpg",
    backdrop_path: null,
    provider_ids: [9],
    overview:
      "A young hobbit inherits a powerful ring and joins an unlikely fellowship on a perilous journey to keep it from the forces of darkness.",
  },
  {
    id: 372058,
    title: "Your Name.",
    release_date: "2016-08-26",
    runtime: 106,
    original_language: "ja",
    genre_ids: [16, 10749, 18],
    vote_average: 8.5,
    vote_count: 11000,
    popularity: 77,
    poster_path: "/q719jXXEzOoYaps6babgKnONONX.jpg",
    backdrop_path: null,
    provider_ids: [8, 350],
    overview:
      "Two teenagers living very different lives begin mysteriously swapping bodies, forming a connection that stretches beyond distance and time.",
  },
  {
    id: 10315,
    title: "Fantastic Mr. Fox",
    release_date: "2009-10-23",
    runtime: 87,
    original_language: "en",
    genre_ids: [12, 16, 35, 10751],
    vote_average: 7.8,
    vote_count: 5600,
    popularity: 74,
    poster_path: "/euZyZb6iGreujYKrGyZHRddhUYh.jpg",
    backdrop_path: null,
    provider_ids: [337, 15],
    overview:
      "A charming fox returns to his chicken-stealing ways, provoking three farmers and forcing his woodland neighbors to come together for an underground escape.",
  },
  {
    id: 122,
    title: "The Lord of the Rings: The Return of the King",
    release_date: "2003-12-17",
    runtime: 201,
    original_language: "en",
    genre_ids: [12, 14, 28],
    vote_average: 8.5,
    vote_count: 24500,
    popularity: 72,
    poster_path: "/rCzpDGLbOoPwLjy3OAm5NUPOTrC.jpg",
    backdrop_path: null,
    provider_ids: [9],
    overview:
      "As armies gather for the final battle for Middle-earth, Frodo and Sam face the last miles of their journey to destroy the One Ring.",
  },
  {
    id: 1858,
    title: "Transformers",
    release_date: "2007-06-27",
    runtime: 144,
    original_language: "en",
    genre_ids: [12, 878, 28],
    vote_average: 6.8,
    vote_count: 11200,
    popularity: 69,
    poster_path: "/lkZ9gqCEjzX85lKR6Jjd1uGAXNp.jpg",
    backdrop_path: null,
    provider_ids: [9, 8],
    overview:
      "A teenager discovers that his first car is a robot from another world, pulling him into a battle between two factions of powerful alien machines.",
  },
  {
    id: 103,
    title: "Taxi Driver",
    release_date: "1976-02-09",
    runtime: 114,
    original_language: "en",
    genre_ids: [80, 18],
    vote_average: 8.1,
    vote_count: 12000,
    popularity: 66,
    poster_path: "/ekstpH614fwDX8DUln1a2Opz0N8.jpg",
    backdrop_path: null,
    provider_ids: [350, 9],
    overview:
      "A lonely night-shift taxi driver moves through New York City, becoming increasingly consumed by the violence and isolation he sees around him.",
  },
  {
    id: 1417,
    title: "Pan's Labyrinth",
    release_date: "2006-10-10",
    runtime: 118,
    original_language: "es",
    genre_ids: [14, 18, 10752],
    vote_average: 7.8,
    vote_count: 10500,
    popularity: 64,
    poster_path: "/s8C4whhKtDaJvMDcyiMvx3BIF5F.jpg",
    backdrop_path: null,
    provider_ids: [15],
    overview:
      "In postwar Spain, a young girl discovers an ancient labyrinth and a mysterious faun whose magical trials offer an escape from the cruelty around her.",
  },
  {
    id: 637,
    title: "Life Is Beautiful",
    release_date: "1997-12-20",
    runtime: 116,
    original_language: "it",
    genre_ids: [35, 18],
    vote_average: 8.4,
    vote_count: 12500,
    popularity: 63,
    poster_path: "/74hLDKjD5aGYOotO6esUVaeISa2.jpg",
    backdrop_path: null,
    provider_ids: [9, 350],
    overview:
      "A playful father uses imagination and humor to protect his young son as their family faces the horrors of a concentration camp.",
  },
  {
    id: 11216,
    title: "Cinema Paradiso",
    release_date: "1988-11-17",
    runtime: 124,
    original_language: "it",
    genre_ids: [18, 10749],
    vote_average: 8.4,
    vote_count: 4400,
    popularity: 60,
    poster_path: "/8SRUfRUi6x4O68n0VCbDNRa6iGL.jpg",
    backdrop_path: null,
    provider_ids: [9],
    overview:
      "A filmmaker remembers his childhood friendship with the projectionist at a small Sicilian cinema, and the movies that opened his world.",
  },
  {
    id: 19404,
    title: "Dilwale Dulhania Le Jayenge",
    release_date: "1995-10-20",
    runtime: 190,
    original_language: "hi",
    genre_ids: [35, 18, 10749],
    vote_average: 8.5,
    vote_count: 4500,
    popularity: 49,
    poster_path: "/lfRkUr7DYdHldAqi3PwdQGBRBPM.jpg",
    backdrop_path: null,
    provider_ids: [8, 9],
    overview:
      "Two young travelers fall in love during a European holiday, then must find a way to honor both their feelings and their families’ expectations.",
  },
];
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
