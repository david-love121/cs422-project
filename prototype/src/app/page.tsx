"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  ArrowDown,
  ArrowRight,
  Bookmark,
  Check,
  ChevronDown,
  Clapperboard,
  Clock3,
  ExternalLink,
  Film,
  Globe2,
  Heart,
  Popcorn,
  RotateCcw,
  Search,
  SlidersHorizontal,
  Sparkles,
  Star,
  Ticket,
  Tv,
  X,
} from "lucide-react";
import {
  DEFAULT_FILTERS,
  imageUrl,
  type Filters,
  type Genre,
  type Language,
  type Movie,
  type Provider,
} from "@/lib/tmdb";
import { DEMO_MOVIES } from "@/lib/demo";
import {
  fetchCatalog,
  fetchMovies,
  fetchMovieDetails,
  type Catalog,
} from "@/lib/tmdb-client";

const SAVED_KEY = "movie-night-shortlist-v1";
const RUNTIME_OPTIONS = [
  ["", "Any length"],
  ["short", "90 minutes or less"],
  ["medium", "91–120 minutes"],
  ["long", "121–180 minutes"],
  ["epic", "Over 3 hours"],
];
const YEAR_OPTIONS = [
  ["", "Any decade"],
  ["2020", "2020s"],
  ["2010", "2010s"],
  ["2000", "2000s"],
  ["1990", "1990s"],
  ["classic", "Before 1990"],
];
const GENRE_ORDER = [35, 18, 28, 12, 878, 10749, 53, 16, 27, 14, 10751, 80];
const PROVIDER_ORDER = [8, 9, 337, 1899, 15, 350, 531, 386];

function Modal({
  title,
  children,
  onClose,
  className = "",
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  className?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      dialog?.close();
      document.body.style.overflow = overflow;
    };
  }, []);
  return (
    <dialog
      ref={ref}
      aria-label={title}
      className={`modal ${className}`}
      onCancel={onClose}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="modal-inner">
        <button
          className="icon-button modal-close"
          onClick={onClose}
          aria-label={`Close ${title}`}
        >
          <X size={20} />
        </button>
        {children}
      </div>
    </dialog>
  );
}

function Poster({
  movie,
  className = "",
}: {
  movie: Movie;
  className?: string;
}) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const src = imageUrl(movie.poster_path);
  return (
    <div className={`poster ${className}`}>
      {src && failedSrc !== src ? (
        <img
          src={src}
          alt={`${movie.title} poster`}
          loading="lazy"
          onError={() => setFailedSrc(src)}
        />
      ) : (
        <div className="poster-fallback">
          <Film size={34} />
          <span>{movie.title}</span>
        </div>
      )}
    </div>
  );
}

function FilterPanel({
  filters,
  genres,
  languages,
  providers,
  onChange,
  onReset,
}: {
  filters: Filters;
  genres: Genre[];
  languages: Language[];
  providers: Provider[];
  onChange: (filters: Filters) => void;
  onReset: () => void;
}) {
  const [allGenres, setAllGenres] = useState(false);
  const [allProviders, setAllProviders] = useState(false);
  const [providerSearch, setProviderSearch] = useState("");
  const orderedGenres = [...genres].sort(
    (a, b) =>
      (GENRE_ORDER.indexOf(a.id) < 0 ? 99 : GENRE_ORDER.indexOf(a.id)) -
      (GENRE_ORDER.indexOf(b.id) < 0 ? 99 : GENRE_ORDER.indexOf(b.id)),
  );
  const orderedProviders = [...providers].sort(
    (a, b) =>
      (PROVIDER_ORDER.indexOf(a.provider_id) < 0
        ? 99
        : PROVIDER_ORDER.indexOf(a.provider_id)) -
      (PROVIDER_ORDER.indexOf(b.provider_id) < 0
        ? 99
        : PROVIDER_ORDER.indexOf(b.provider_id)),
  );
  const visibleProviders = allProviders
    ? orderedProviders.filter((provider) =>
        provider.provider_name
          .toLowerCase()
          .includes(providerSearch.toLowerCase()),
      )
    : orderedProviders.slice(0, 6);
  function toggleGenre(id: number) {
    onChange({
      ...filters,
      genres: filters.genres.includes(id)
        ? filters.genres.filter((genre) => genre !== id)
        : [...filters.genres, id],
    });
  }
  function toggleProvider(id: number) {
    onChange({
      ...filters,
      providers: filters.providers.includes(id)
        ? filters.providers.filter((provider) => provider !== id)
        : [...filters.providers, id],
    });
  }
  return (
    <div className="filter-panel">
      <div className="filter-heading">
        <h2>
          <SlidersHorizontal size={17} /> Make it your night
        </h2>
        <button
          className="text-button reset-button"
          onClick={onReset}
          aria-label="Reset filters"
        >
          <RotateCcw size={14} /> Reset
        </button>
      </div>
      <section className="filter-section">
        <div className="label-row">
          <h3>What’s the mood?</h3>
          <span>Pick a few</span>
        </div>
        <div className="genre-chips">
          {(allGenres ? orderedGenres : orderedGenres.slice(0, 10)).map(
            (genre) => (
              <button
                key={genre.id}
                className={`genre-chip ${filters.genres.includes(genre.id) ? "selected" : ""}`}
                aria-pressed={filters.genres.includes(genre.id)}
                onClick={() => toggleGenre(genre.id)}
              >
                {filters.genres.includes(genre.id) && <Check size={12} />}
                {genre.name === "Science Fiction" ? "Sci-Fi" : genre.name}
              </button>
            ),
          )}
        </div>
        <button
          className="text-button more-button"
          onClick={() => setAllGenres(!allGenres)}
        >
          {allGenres ? "Fewer genres" : "All genres"}
          <ChevronDown size={14} className={allGenres ? "flipped" : ""} />
        </button>
        {filters.genres.length > 1 && (
          <label className="check-label">
            <input
              type="checkbox"
              checked={filters.genreMode === "all"}
              onChange={(event) =>
                onChange({
                  ...filters,
                  genreMode: event.target.checked ? "all" : "any",
                })
              }
            />
            Must include every selected genre
          </label>
        )}
      </section>
      <section className="filter-section filter-fields">
        <label>
          <span>
            <Globe2 size={15} />
            Original language
          </span>
          <select
            value={filters.language}
            onChange={(event) =>
              onChange({ ...filters, language: event.target.value })
            }
          >
            <option value="">Any language</option>
            {[...languages]
              .sort((a, b) => a.english_name.localeCompare(b.english_name))
              .map((language) => (
                <option key={language.iso_639_1} value={language.iso_639_1}>
                  {language.english_name || language.name}
                </option>
              ))}
          </select>
        </label>
        <label>
          <span>
            <Clock3 size={15} />
            Movie length
          </span>
          <select
            value={filters.runtime}
            onChange={(event) =>
              onChange({ ...filters, runtime: event.target.value })
            }
          >
            {RUNTIME_OPTIONS.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <div className="split-fields">
          <label>
            <span>Release decade</span>
            <select
              value={filters.year}
              onChange={(event) =>
                onChange({ ...filters, year: event.target.value })
              }
            >
              {YEAR_OPTIONS.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Minimum rating</span>
            <select
              value={filters.rating}
              onChange={(event) =>
                onChange({ ...filters, rating: event.target.value })
              }
            >
              <option value="">Any rating</option>
              <option value="6">6+ / 10</option>
              <option value="7">7+ / 10</option>
              <option value="8">8+ / 10</option>
            </select>
          </label>
        </div>
      </section>
      <section className="filter-section providers-section">
        <div className="label-row">
          <h3>
            <Tv size={15} />
            Streaming platforms
          </h3>
          <span>USA</span>
        </div>
        <p className="field-hint">Included, free, or with ads. No rentals.</p>
        {allProviders && (
          <label className="provider-search">
            <Search size={14} />
            <input
              aria-label="Search streaming platforms"
              placeholder="Find a service…"
              value={providerSearch}
              onChange={(event) => setProviderSearch(event.target.value)}
            />
          </label>
        )}
        <div className="provider-list">
          {visibleProviders.map((provider) => (
            <button
              className={`provider-button ${filters.providers.includes(provider.provider_id) ? "selected" : ""}`}
              key={provider.provider_id}
              aria-pressed={filters.providers.includes(provider.provider_id)}
              onClick={() => toggleProvider(provider.provider_id)}
            >
              <span
                aria-hidden="true"
                className={`provider-logo provider-${provider.provider_id}`}
              >
                {provider.logo_path ? (
                  <img
                    src={imageUrl(provider.logo_path)}
                    alt=""
                    width={23}
                    height={23}
                  />
                ) : (
                  provider.provider_name.slice(0, 1)
                )}
              </span>
              <span>{provider.provider_name}</span>
              <span className="provider-check">
                {filters.providers.includes(provider.provider_id) && (
                  <Check size={12} />
                )}
              </span>
            </button>
          ))}
        </div>
        {allProviders && visibleProviders.length === 0 && (
          <p className="field-hint">No services match that name.</p>
        )}
        {providers.length > 6 && (
          <button
            className="text-button more-button"
            onClick={() => setAllProviders(!allProviders)}
          >
            {allProviders ? "Fewer services" : "All streaming services"}
            <ChevronDown size={14} />
          </button>
        )}
        <p className="field-hint provider-note">
          Matches any selected service. Availability via{" "}
          <a href="https://www.justwatch.com/" target="_blank" rel="noreferrer">
            JustWatch
          </a>
          .
        </p>
      </section>
      <div className="filter-tip">
        <Heart size={17} />
        <p>
          A little something for everyone.
          <br />
          <span>Find a few favorites, then decide together.</span>
        </p>
      </div>
    </div>
  );
}

export default function Home() {
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [catalogError, setCatalogError] = useState("");
  const [catalogRetry, setCatalogRetry] = useState(0);
  const genres = catalog?.genres ?? [];
  const languages = catalog?.languages ?? [];
  const providers = catalog?.providers ?? [];
  const isLive = catalog?.mode === "live";
  const isDemo = catalog?.mode === "demo";
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [saved, setSaved] = useState<Movie[]>([]);
  const [storageReady, setStorageReady] = useState(false);
  const [storageNote, setStorageNote] = useState("");
  const [view, setView] = useState<"explore" | "shortlist">("explore");
  const [page, setPage] = useState(1);
  const [retry, setRetry] = useState(0);
  const [live, setLive] = useState<{
    movies: Movie[];
    total: number;
    pages: number;
    loading: boolean;
    error: string;
  }>({ movies: [], total: 0, pages: 0, loading: true, error: "" });
  const [selectedMovie, setSelectedMovie] = useState<Movie | null>(null);
  const [detail, setDetail] = useState<{
    movie: Movie | null;
    loading: boolean;
    error: string;
  }>({ movie: null, loading: false, error: "" });
  const resultsRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        const stored: unknown = JSON.parse(
          localStorage.getItem(SAVED_KEY) || "[]",
        );
        if (Array.isArray(stored))
          setSaved(
            stored
              .filter(
                (movie): movie is Movie =>
                  typeof movie === "object" &&
                  movie !== null &&
                  typeof movie.id === "number" &&
                  typeof movie.title === "string" &&
                  Array.isArray(movie.genre_ids),
              )
              .slice(0, 100),
          );
      } catch {
        setStorageNote(
          "Your shortlist will stay available until you close this page.",
        );
      }
      setStorageReady(true);
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!storageReady) return;
    try {
      localStorage.setItem(SAVED_KEY, JSON.stringify(saved));
    } catch {
      /* In-memory shortlist still works. */
    }
  }, [saved, storageReady]);

  useEffect(() => {
    const controller = new AbortController();
    fetchCatalog(controller.signal)
      .then((data) => {
        if (!controller.signal.aborted) setCatalog(data);
      })
      .catch((error) => {
        if (!controller.signal.aborted)
          setCatalogError(
            error instanceof Error
              ? error.message
              : "Couldn’t load movie preferences. Please try again.",
          );
      });
    return () => controller.abort();
  }, [catalogRetry]);

  useEffect(() => {
    if (!catalog) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setLive((previous) => ({ ...previous, loading: true, error: "" }));
      try {
        const response = await fetchMovies(filters, page, controller.signal);
        if (!controller.signal.aborted)
          setLive({
            movies: response.results,
            total: response.total_results,
            pages: Math.min(response.total_pages, 500),
            loading: false,
            error: "",
          });
      } catch (error) {
        if (!controller.signal.aborted)
          setLive({
            movies: [],
            total: 0,
            pages: 0,
            loading: false,
            error:
              error instanceof Error
                ? error.message
                : "Couldn’t load movies. Please try again.",
          });
      }
    }, 200);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [catalog, filters, page, retry]);

  useEffect(() => {
    if (!selectedMovie) return;
    const controller = new AbortController();
    fetchMovieDetails(selectedMovie.id, controller.signal)
      .then((movie) => {
        if (!controller.signal.aborted)
          setDetail({ movie, loading: false, error: "" });
      })
      .catch((error) => {
        if (!controller.signal.aborted)
          setDetail({
            movie: null,
            loading: false,
            error:
              error instanceof Error ? error.message : "Couldn’t load details.",
          });
      });
    return () => controller.abort();
  }, [selectedMovie]);

  const movies = view === "shortlist" ? saved : live.movies;
  const total = view === "shortlist" ? saved.length : live.total;
  const loading =
    view === "explore" && !catalogError && (!catalog || live.loading);
  const error = view === "explore" ? catalogError || live.error : "";
  const filterCount =
    filters.genres.length +
    filters.providers.length +
    Number(!!filters.language) +
    Number(!!filters.runtime) +
    Number(!!filters.year) +
    Number(!!filters.rating);
  const detailMovie = detail.movie || selectedMovie;

  function changeFilters(value: Filters) {
    if (JSON.stringify(value) === JSON.stringify(filters)) return;
    setFilters(value);
    setPage(1);
    setLive((previous) => ({ ...previous, loading: true }));
  }
  function toggleSaved(movie: Movie) {
    setSaved((current) =>
      current.some((item) => item.id === movie.id)
        ? current.filter((item) => item.id !== movie.id)
        : [...current, movie],
    );
  }
  function openMovie(movie: Movie) {
    setSelectedMovie(movie);
    setDetail({ movie: null, loading: true, error: "" });
  }
  function switchView(nextView: "explore" | "shortlist") {
    setView(nextView);
  }
  function retryCollection() {
    if (!catalog) {
      setCatalogError("");
      setCatalogRetry((value) => value + 1);
    } else {
      setLive((previous) => ({ ...previous, loading: true, error: "" }));
      setRetry((value) => value + 1);
    }
  }
  const filterPanel = (
    <FilterPanel
      filters={filters}
      genres={genres}
      languages={languages}
      providers={providers}
      onChange={changeFilters}
      onReset={() => changeFilters(DEFAULT_FILTERS)}
    />
  );

  return (
    <>
      <a href="#movies" className="skip-link">
        Skip to movies
      </a>
      <header className="site-header">
        <div className="header-inner">
          <Link href="/" className="brand" aria-label="Movie Night home">
            <span className="brand-mark">
              <Clapperboard size={23} strokeWidth={1.6} />
            </span>
            <span>
              movie<span className="brand-light">night</span>
              <span className="brand-dot">.</span>
            </span>
          </Link>
          <nav className="main-nav" aria-label="Main navigation">
            <button
              className={view === "explore" ? "active" : ""}
              onClick={() => switchView("explore")}
            >
              Explore
            </button>
            <button
              className={view === "shortlist" ? "active" : ""}
              onClick={() => switchView("shortlist")}
            >
              Shortlist <span className="nav-count">{saved.length}</span>
            </button>
          </nav>
          <div
            className={`catalog-status ${isLive ? "connected" : ""}`}
            role="status"
          >
            <span className="status-dot" />
            <span>
              {catalog
                ? isLive
                  ? "Live collection"
                  : "Sample collection"
                : catalogError
                  ? "Collection unavailable"
                  : "Loading collection…"}
            </span>
          </div>
        </div>
      </header>

      <main className="page-shell">
        <section className="hero" aria-labelledby="hero-title">
          <div className="hero-copy">
            <div className="eyebrow">
              <span />
              THE BEST NIGHTS START WITH A MOVIE
            </div>
            <h1 id="hero-title">
              Find your next
              <br />
              <em>“everyone’s in.”</em>
            </h1>
            <p>
              Big laughs, wild adventures, or just one more plot twist.
              <br className="desktop-break" /> Find something you’ll all want to
              watch.
            </p>
            <button
              className="hero-link"
              onClick={() =>
                resultsRef.current?.scrollIntoView({
                  behavior: "smooth",
                  block: "start",
                })
              }
            >
              Let’s find your movie <ArrowDown size={16} />
            </button>
          </div>
          <div className="hero-art" aria-hidden="true">
            <span className="orbit orbit-one" />
            <span className="orbit orbit-two" />
            <Sparkles className="hero-sparkle" size={28} strokeWidth={1} />
            <div className="hero-posters">
              {[
                DEMO_MOVIES.find((movie) => movie.id === 508442),
                DEMO_MOVIES.find((movie) => movie.id === 120),
                DEMO_MOVIES.find((movie) => movie.id === 120467),
              ].map((movie, index) => (
                <div className={`hero-poster hero-poster-${index}`} key={index}>
                  {movie ? <Poster movie={movie} /> : <Film size={40} />}
                </div>
              ))}
            </div>
            <div className="hero-ticket">
              <span className="ticket-icon">
                <Popcorn size={23} />
              </span>
              <div>
                Good company. Great cinema.
                <span>Your next movie night, sorted.</span>
              </div>
              <Heart size={16} />
            </div>
            <span className="hero-caption">
              ONE COUCH. ENDLESS POSSIBILITIES.
            </span>
          </div>
        </section>

        <div className={`collection-banner ${isLive ? "live-banner" : ""}`}>
          <span className="banner-icon">
            {catalog ? (
              isLive ? (
                <Globe2 size={17} />
              ) : (
                <Ticket size={18} />
              )
            ) : (
              <Popcorn size={18} />
            )}
          </span>
          <p>
            {isLive ? (
              <>
                <strong>You’re exploring TMDB.</strong> Find your next favorite
                with movies and streaming services available in the USA.
              </>
            ) : isDemo ? (
              <>
                <strong>A little preview of movie night.</strong> The live
                collection isn’t connected yet. Explore our sample movies in the
                meantime.
              </>
            ) : catalogError ? (
              <>
                <strong>A brief intermission.</strong> We’re having trouble
                loading the collection. You can still browse your saved
                shortlist.
              </>
            ) : (
              <>
                <strong>Your next movie night is on its way.</strong> Gathering
                movies and preferences for your group.
              </>
            )}
          </p>
        </div>

        <div
          className={`workspace ${view === "shortlist" ? "shortlist-workspace" : ""}`}
        >
          {view === "explore" && (
            <aside className="desktop-filters" aria-label="Movie filters">
              {catalog ? (
                filterPanel
              ) : (
                <div className="filter-loading">
                  <SlidersHorizontal size={20} />
                  <p>
                    {catalogError
                      ? "Preferences are unavailable right now."
                      : "Loading your movie preferences…"}
                  </p>
                </div>
              )}
            </aside>
          )}
          <section
            id="movies"
            className="results"
            ref={resultsRef}
            aria-labelledby="results-heading"
            aria-busy={loading}
          >
            <div className="results-topline">
              <div>
                <div className="eyebrow small">
                  {view === "shortlist"
                    ? "THE ONES WORTH SAVING"
                    : "LESS SCROLLING, MORE WATCHING"}
                </div>
                <h2 id="results-heading">
                  {view === "shortlist"
                    ? "Your shortlist"
                    : filterCount
                      ? "A little more your style"
                      : "Made for movie night"}
                  <span className="result-count">
                    {loading ? "…" : total.toLocaleString()}
                  </span>
                </h2>
                <p className="results-description">
                  {view === "shortlist"
                    ? "Gather your favorites. Let the group make the final call."
                    : isDemo
                      ? "A few crowd-pleasers to get the conversation started."
                      : "Your preferences. A whole world of movies."}
                </p>
              </div>
              {view === "explore" && (
                <label className="sort-control">
                  <span>Sort by</span>
                  <select
                    aria-label="Sort movies"
                    value={filters.sort}
                    onChange={(event) =>
                      changeFilters({ ...filters, sort: event.target.value })
                    }
                  >
                    <option value="popularity.desc">Most popular</option>
                    <option value="vote_average.desc">Top rated</option>
                    <option value="primary_release_date.desc">
                      Newest first
                    </option>
                    <option value="title.asc">Title A–Z</option>
                  </select>
                </label>
              )}
            </div>
            {view === "explore" && (
              <div className="mobile-filter-row">
                <button
                  className="secondary-button"
                  onClick={() => setFiltersOpen(true)}
                  disabled={!catalog}
                >
                  <SlidersHorizontal size={16} />
                  Filters {filterCount > 0 && <span>{filterCount}</span>}
                </button>
                <span>
                  {catalog
                    ? isLive
                      ? "Live TMDB results"
                      : "Sample collection"
                    : "Movie collection"}{" "}
                  · USA
                </span>
              </div>
            )}
            {view === "explore" && filterCount > 0 && (
              <div className="active-filters" aria-label="Active filters">
                {filters.genres.map((id) => (
                  <button
                    key={id}
                    onClick={() =>
                      changeFilters({
                        ...filters,
                        genres: filters.genres.filter((genre) => genre !== id),
                      })
                    }
                  >
                    {genres.find((genre) => genre.id === id)?.name || "Genre"}
                    <X size={12} />
                    <span className="sr-only">Remove filter</span>
                  </button>
                ))}
                {filters.providers.map((id) => (
                  <button
                    key={`p${id}`}
                    onClick={() =>
                      changeFilters({
                        ...filters,
                        providers: filters.providers.filter(
                          (provider) => provider !== id,
                        ),
                      })
                    }
                  >
                    {providers.find((provider) => provider.provider_id === id)
                      ?.provider_name || "Service"}
                    <X size={12} />
                    <span className="sr-only">Remove filter</span>
                  </button>
                ))}
                {filters.language && (
                  <button
                    onClick={() => changeFilters({ ...filters, language: "" })}
                  >
                    {languages.find(
                      (language) => language.iso_639_1 === filters.language,
                    )?.english_name || filters.language}
                    <X size={12} />
                    <span className="sr-only">Remove filter</span>
                  </button>
                )}
                {filters.runtime && (
                  <button
                    onClick={() => changeFilters({ ...filters, runtime: "" })}
                  >
                    {
                      RUNTIME_OPTIONS.find(
                        ([value]) => value === filters.runtime,
                      )?.[1]
                    }
                    <X size={12} />
                    <span className="sr-only">Remove filter</span>
                  </button>
                )}
                {filters.year && (
                  <button
                    onClick={() => changeFilters({ ...filters, year: "" })}
                  >
                    {
                      YEAR_OPTIONS.find(
                        ([value]) => value === filters.year,
                      )?.[1]
                    }
                    <X size={12} />
                    <span className="sr-only">Remove filter</span>
                  </button>
                )}
                {filters.rating && (
                  <button
                    onClick={() => changeFilters({ ...filters, rating: "" })}
                  >
                    {filters.rating}+ rating
                    <X size={12} />
                    <span className="sr-only">Remove filter</span>
                  </button>
                )}
                <button
                  className="clear-all"
                  onClick={() => changeFilters(DEFAULT_FILTERS)}
                >
                  Clear all
                </button>
              </div>
            )}
            {isDemo && filters.providers.length > 0 && view === "explore" && (
              <p className="sample-availability">
                <Tv size={14} />
                Sample service assignments only. They do not reflect current US
                availability.
              </p>
            )}
            {storageNote && <p className="field-hint">{storageNote}</p>}
            <div className="sr-only" aria-live="polite">
              {loading
                ? "Loading movies"
                : `${total} ${view === "shortlist" ? "saved movies" : "movies found"}`}
            </div>
            {loading ? (
              <div
                className="movie-grid skeleton-grid"
                aria-label="Loading movies"
              >
                {Array.from({ length: 8 }, (_, index) => (
                  <div className="skeleton-card" key={index}>
                    <div />
                    <span />
                    <span />
                  </div>
                ))}
              </div>
            ) : error ? (
              <div className="empty-state" role="alert">
                <Globe2 size={34} />
                <h3>A brief intermission.</h3>
                <p>{error}</p>
                <div className="empty-actions">
                  <button className="primary-button" onClick={retryCollection}>
                    Try again
                  </button>
                </div>
              </div>
            ) : movies.length === 0 ? (
              <div className="empty-state">
                <Popcorn size={40} strokeWidth={1.25} />
                <h3>
                  {view === "shortlist"
                    ? "Your movie night starts here."
                    : "A plot twist. No matches yet."}
                </h3>
                <p>
                  {view === "shortlist"
                    ? "Save a movie that catches your eye and it’ll be waiting here."
                    : isDemo
                      ? "Try fewer filters to explore more of this sample collection."
                      : "Try a different genre or give yourself a little more time."}
                </p>
                <button
                  className="primary-button"
                  onClick={() =>
                    view === "shortlist"
                      ? switchView("explore")
                      : changeFilters(DEFAULT_FILTERS)
                  }
                >
                  {view === "shortlist" ? "Explore movies" : "Reset filters"}
                  <ArrowRight size={16} />
                </button>
              </div>
            ) : (
              <div className="movie-grid">
                {movies.map((movie) => {
                  const isSaved = saved.some((item) => item.id === movie.id);
                  const movieGenres = movie.genre_ids
                    .map((id) => genres.find((genre) => genre.id === id)?.name)
                    .filter(Boolean);
                  return (
                    <article className="movie-card" key={movie.id}>
                      <div className="movie-art">
                        <button
                          className="poster-button"
                          aria-label={`View details for ${movie.title}`}
                          onClick={() => openMovie(movie)}
                        >
                          <Poster movie={movie} />
                          <span className="poster-hover">
                            Take a closer look <ArrowRight size={15} />
                          </span>
                        </button>
                        <span className="rating-badge">
                          <Star size={11} fill="currentColor" />
                          {movie.vote_average > 0
                            ? movie.vote_average.toFixed(1)
                            : "New"}
                        </span>
                        <button
                          className={`save-button ${isSaved ? "saved" : ""}`}
                          aria-label={
                            isSaved
                              ? `Remove ${movie.title} from shortlist`
                              : `Save ${movie.title}`
                          }
                          aria-pressed={isSaved}
                          onClick={() => toggleSaved(movie)}
                        >
                          {isSaved ? (
                            <Check size={17} />
                          ) : (
                            <Bookmark size={17} />
                          )}
                        </button>
                      </div>
                      <div className="movie-info">
                        <button
                          className="movie-title"
                          onClick={() => openMovie(movie)}
                        >
                          {movie.title}
                        </button>
                        <div className="movie-meta">
                          <span>
                            {movie.release_date?.slice(0, 4) || "Release TBA"}
                          </span>
                          <span className="meta-dot" />
                          <span>
                            {movie.original_language?.toUpperCase() || "—"}
                          </span>
                          {!!movie.runtime && (
                            <>
                              <span className="meta-dot" />
                              <span>{movie.runtime} min</span>
                            </>
                          )}
                        </div>
                        <p className="movie-genres">
                          {movieGenres.slice(0, 2).join(" / ") ||
                            "Discover something different"}
                        </p>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
            {!loading && !error && view === "explore" && live.pages > 1 && (
              <div className="pagination">
                <button
                  className="secondary-button"
                  disabled={page === 1}
                  onClick={() => {
                    setPage((value) => value - 1);
                    setLive((previous) => ({ ...previous, loading: true }));
                    resultsRef.current?.scrollIntoView({
                      behavior: "smooth",
                    });
                  }}
                >
                  Previous
                </button>
                <span>
                  Page {page} of {live.pages.toLocaleString()}
                </span>
                <button
                  className="secondary-button"
                  disabled={page >= live.pages}
                  onClick={() => {
                    setPage((value) => value + 1);
                    setLive((previous) => ({ ...previous, loading: true }));
                    resultsRef.current?.scrollIntoView({
                      behavior: "smooth",
                    });
                  }}
                >
                  Next
                  <ArrowRight size={15} />
                </button>
              </div>
            )}
            {isDemo &&
              !loading &&
              !error &&
              view === "explore" &&
              movies.length > 0 && (
                <div className="collection-end">
                  <span />
                  <Popcorn size={18} />
                  <span />
                  <p>
                    Just a taste of what’s out there.
                    <br />
                    Save a few favorites and make it a movie night.
                  </p>
                </div>
              )}
          </section>
        </div>
      </main>

      <footer className="site-footer">
        <div className="footer-main">
          <span className="footer-brand">
            <Clapperboard size={17} />A good movie brings us together.
          </span>
          <span>Made for your next night in.</span>
        </div>
        <div className="attribution">
          <a
            href="https://www.themoviedb.org/"
            target="_blank"
            rel="noreferrer"
            aria-label="The Movie Database"
          >
            <img
              src="/tmdb.svg"
              onError={(event) => {
                event.currentTarget.style.display = "none";
              }}
              alt=""
            />
            <strong>TMDB</strong>
          </a>
          <p>
            This product uses the TMDB API but is not endorsed or certified by
            TMDB.
            <br />
            Streaming availability provided by{" "}
            <a
              href="https://www.justwatch.com/"
              target="_blank"
              rel="noreferrer"
            >
              JustWatch
            </a>
            . US catalog.{" "}
            {isDemo
              ? "Sample movies and service assignments are for demonstration."
              : "Availability can change."}
          </p>
        </div>
      </footer>

      {filtersOpen && (
        <Modal
          title="Your movie preferences"
          onClose={() => setFiltersOpen(false)}
          className="filter-modal"
        >
          <h2 className="modal-title">Your movie preferences</h2>
          {filterPanel}
          <button
            className="primary-button apply-filters"
            onClick={() => {
              setFiltersOpen(false);
              resultsRef.current?.scrollIntoView({ behavior: "smooth" });
            }}
          >
            Show movies
            <ArrowRight size={17} />
          </button>
        </Modal>
      )}
      {selectedMovie && detailMovie && (
        <Modal
          title={selectedMovie.title}
          onClose={() => setSelectedMovie(null)}
          className="details-modal"
        >
          <div className="detail-layout">
            <Poster movie={detailMovie} />
            <div className="detail-copy">
              <div className="eyebrow small">YOUR NEXT MOVIE NIGHT?</div>
              <h2 className="modal-title">{detailMovie.title}</h2>
              <div className="detail-meta">
                <span>
                  <Star size={14} fill="currentColor" />
                  {detailMovie.vote_average.toFixed(1)}
                </span>
                <span>{detailMovie.release_date?.slice(0, 4)}</span>
                {detailMovie.runtime ? (
                  <span>
                    <Clock3 size={14} />
                    {detailMovie.runtime} min
                  </span>
                ) : detail.loading ? (
                  <span>Loading runtime…</span>
                ) : null}
                <span>
                  {languages.find(
                    (language) =>
                      language.iso_639_1 === detailMovie.original_language,
                  )?.english_name ||
                    detailMovie.original_language?.toUpperCase()}
                </span>
              </div>
              <div className="detail-genres">
                {detailMovie.genre_ids.map((id) => (
                  <span key={id}>
                    {genres.find((genre) => genre.id === id)?.name || "Movie"}
                  </span>
                ))}
              </div>
              <p className="overview">
                {detailMovie.overview ||
                  "No synopsis available yet. Sometimes the best movies are a surprise."}
              </p>
              {detail.error && (
                <p className="form-error" role="alert">
                  {detail.error}
                </p>
              )}
              <button
                className="primary-button"
                onClick={() => toggleSaved(detailMovie)}
              >
                {saved.some((movie) => movie.id === detailMovie.id) ? (
                  <>
                    <Check size={17} />
                    Saved to shortlist
                  </>
                ) : (
                  <>
                    <Bookmark size={17} />
                    Add to shortlist
                  </>
                )}
              </button>
              <a
                className="details-link"
                href={`https://www.themoviedb.org/movie/${detailMovie.id}/watch?locale=US`}
                target="_blank"
                rel="noreferrer"
              >
                View movie & US watch options
                <ExternalLink size={13} />
              </a>
              <p className="field-hint">
                Watch options via TMDB and JustWatch.
                {isDemo && " This is a sample movie record."}
              </p>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}
