"use client";

import VetoSession from "@/components/veto-session";
import DemoWalkthrough from "@/components/demo-walkthrough";
import { useEffect, useRef, useState } from "react";
import { Modal } from "@/components/dialog";
import MoviePoster from "@/components/movie-poster";
import SettingsMenu from "@/components/settings-menu";
import { parseSavedMovies } from "@/lib/movie";
import { CATALOG_SNAPSHOT_DATE, DEMO_GENRES } from "@/lib/demo";
import {
  MAX_FILTER_IDS,
  RUNTIME_OPTIONS,
  YEAR_OPTIONS,
  RATING_OPTIONS,
} from "@/lib/catalog";
import {
  ArrowRight,
  Bookmark,
  Check,
  ChevronDown,
  Clock3,
  ExternalLink,
  Film,
  Globe2,
  Heart,
  RotateCcw,
  Search,
  SlidersHorizontal,
  Star,
  Tv,
  X,
} from "lucide-react";
import {
  DEFAULT_FILTERS,
  imageUrl,
  type Catalog,
  type Filters,
  type Genre,
  type Language,
  type Movie,
  type Provider,
} from "@/lib/tmdb";
import {
  fetchCatalog,
  fetchMovies,
  fetchMovieDetails,
} from "@/lib/tmdb-client";

const SAVED_KEY = "movie-night-shortlist-v1";
const PREFERENCES_KEY = "veto-preferences-v1";
const GENRE_ORDER = [35, 18, 28, 12, 878, 10749, 53, 16, 27, 14, 10751, 80];
const PROVIDER_ORDER = [8, 9, 337, 1899, 15, 350, 531, 386];

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
    if (!filters.genres.includes(id) && filters.genres.length >= MAX_FILTER_IDS)
      return;
    onChange({
      ...filters,
      genres: filters.genres.includes(id)
        ? filters.genres.filter((genre) => genre !== id)
        : [...filters.genres, id],
    });
  }
  function toggleProvider(id: number) {
    if (
      !filters.providers.includes(id) &&
      filters.providers.length >= MAX_FILTER_IDS
    )
      return;
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
          <SlidersHorizontal size={17} /> Filter movies
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
          <h3>Genres</h3>
          <span>Pick a few</span>
        </div>
        <div className="genre-chips">
          {(allGenres ? orderedGenres : orderedGenres.slice(0, 10)).map(
            (genre) => (
              <button
                key={genre.id}
                className={`genre-chip ${filters.genres.includes(genre.id) ? "selected" : ""}`}
                aria-pressed={filters.genres.includes(genre.id)}
                disabled={
                  !filters.genres.includes(genre.id) &&
                  filters.genres.length >= MAX_FILTER_IDS
                }
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
        {filters.genres.length >= MAX_FILTER_IDS && (
          <p className="field-hint" role="status">
            Up to {MAX_FILTER_IDS} genres can be selected. Remove one to choose
            another.
          </p>
        )}
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
              {RATING_OPTIONS.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
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
              disabled={
                !filters.providers.includes(provider.provider_id) &&
                filters.providers.length >= MAX_FILTER_IDS
              }
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
        {filters.providers.length >= MAX_FILTER_IDS && (
          <p className="field-hint" role="status">
            Up to {MAX_FILTER_IDS} streaming services can be selected. Remove one
            to choose another.
          </p>
        )}
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
          Save ideas for the group.
          <br />
          <span>Each viewer can nominate a movie.</span>
        </p>
      </div>
    </div>
  );
}

export default function Home() {
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [dataMode, setDataMode] = useState<"demo" | "live">("demo");
  const [preferencesReady, setPreferencesReady] = useState(false);
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [catalogError, setCatalogError] = useState("");
  const [catalogRetry, setCatalogRetry] = useState(0);
  const [catalogStarted, setCatalogStarted] = useState(false);
  const genres = catalog?.genres ?? DEMO_GENRES;
  const languages = catalog?.languages ?? [];
  const providers = catalog?.providers ?? [];
  const isLive = catalog?.mode === "live";
  const isDemo = catalog?.mode === "demo";
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [saved, setSaved] = useState<Movie[]>([]);
  const [demoRun, setDemoRun] = useState<number | null>(null);
  const [demoSaved, setDemoSaved] = useState<Movie[]>([]);
  const demoActive = demoRun !== null;
  const activeSaved = demoActive ? demoSaved : saved;
  const demoReturn = useRef<{ mode: "demo" | "live"; view: "session" | "explore" | "shortlist" } | null>(null);
  const [shortlistNotice, setShortlistNotice] = useState("");
  const [storageReady, setStorageReady] = useState(false);
  const [storageNote, setStorageNote] = useState("");
  const [view, setView] = useState<"session" | "explore" | "shortlist">(
    "session",
  );
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
  const workspaceHeadingRef = useRef<HTMLHeadingElement>(null);
  const catalogRequest = useRef<AbortController | null>(null);
  const moviesRequest = useRef<AbortController | null>(null);
  const detailRequest = useRef<AbortController | null>(null);

  useEffect(() => {
    if (view !== "session") workspaceHeadingRef.current?.focus();
  }, [view]);

  useEffect(() => {
    if (!shortlistNotice) return;
    const timer = setTimeout(() => setShortlistNotice(""), 3500);
    return () => clearTimeout(timer);
  }, [shortlistNotice]);

  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        const stored: unknown = JSON.parse(localStorage.getItem(PREFERENCES_KEY) || "null");
        if (stored && typeof stored === "object") {
          if ("theme" in stored && (stored.theme === "light" || stored.theme === "dark"))
            setTheme(stored.theme);
          if ("dataMode" in stored && stored.dataMode === "live") {
            setDataMode("live");
            setCatalogStarted(true);
          }
        }
      } catch {
        /* Defaults work when this browser cannot restore settings. */
      }
      setPreferencesReady(true);
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
  }, [theme]);

  useEffect(() => {
    if (!preferencesReady || demoActive) return;
    try {
      localStorage.setItem(PREFERENCES_KEY, JSON.stringify({ theme, dataMode }));
    } catch {
      /* Settings still apply for this visit. */
    }
  }, [theme, dataMode, preferencesReady, demoActive]);

  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        const stored: unknown = JSON.parse(
          localStorage.getItem(SAVED_KEY) || "[]",
        );
        setSaved(parseSavedMovies(stored));
      } catch {
        setStorageNote(
          "Your shortlist will stay available until you close this page.",
        );
      }
      try {
        sessionStorage.removeItem("movie-night-tmdb-token");
      } catch {
        /* Session storage is optional. */
      }
      setStorageReady(true);
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!storageReady) return;
    let note = "";
    try {
      localStorage.setItem(SAVED_KEY, JSON.stringify(saved));
    } catch {
      note =
        "Changes to your shortlist couldn’t be saved on this device. Keep this page open; reloading may lose them.";
    }
    const timer = setTimeout(() => setStorageNote(note), 0);
    return () => clearTimeout(timer);
  }, [saved, storageReady]);

  useEffect(() => {
    if (!catalogStarted) return;
    const controller = new AbortController();
    catalogRequest.current = controller;
    fetchCatalog(controller.signal, dataMode)
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
  }, [catalogStarted, catalogRetry, dataMode]);

  useEffect(() => {
    if (!catalog) return;
    const controller = new AbortController();
    moviesRequest.current = controller;
    const timer = setTimeout(async () => {
      setLive((previous) => ({ ...previous, loading: true, error: "" }));
      try {
        const response = await fetchMovies(filters, page, controller.signal, dataMode);
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
  }, [catalog, filters, page, retry, dataMode]);

  useEffect(() => {
    if (!selectedMovie) return;
    const controller = new AbortController();
    detailRequest.current = controller;
    fetchMovieDetails(selectedMovie.id, controller.signal, dataMode)
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
  }, [selectedMovie, dataMode]);

  const movies = view === "shortlist" ? activeSaved : live.movies;
  const total = view === "shortlist" ? activeSaved.length : live.total;
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
    (demoActive ? setDemoSaved : setSaved)((current) =>
      current.some((item) => item.id === movie.id)
        ? current.filter((item) => item.id !== movie.id)
        : [...current, movie],
    );
  }
  function addSaved(movie: Movie) {
    (demoActive ? setDemoSaved : setSaved)((current) =>
      current.some((item) => item.id === movie.id) ? current : [...current, movie],
    );
  }
  function openMovie(movie: Movie) {
    setSelectedMovie(movie);
    setDetail({ movie: null, loading: true, error: "" });
  }
  function switchView(nextView: "session" | "explore" | "shortlist") {
    if (nextView === "explore") setCatalogStarted(true);
    setView(nextView);
  }
  function changeDataMode(mode: "demo" | "live") {
    if (mode === dataMode) return;
    catalogRequest.current?.abort();
    moviesRequest.current?.abort();
    detailRequest.current?.abort();
    setDataMode(mode);
    if (mode === "live") setCatalogStarted(true);
    setCatalog(null);
    setCatalogError("");
    setPage(1);
    setLive({ movies: [], total: 0, pages: 0, loading: true, error: "" });
    setSelectedMovie(null);
    setDetail({ movie: null, loading: false, error: "" });
  }
  function startDemo() {
    if (!demoActive) demoReturn.current = { mode: dataMode, view };
    changeDataMode("demo");
    setSelectedMovie(null);
    setFiltersOpen(false);
    setShortlistNotice("");
    setDemoSaved([]);
    setView("session");
    setDemoRun((previous) => (previous ?? 0) + 1);
    window.scrollTo({ top: 0, behavior: "instant" });
  }
  function exitDemo() {
    const previous = demoReturn.current;
    if (previous) {
      changeDataMode(previous.mode);
      setView(previous.view);
    }
    setDemoRun(null);
    setDemoSaved([]);
    demoReturn.current = null;
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
      <div inert={demoActive} className={demoActive ? "demo-underway" : undefined}>
      <a href="#main-content" className="skip-link">
        Skip to content
      </a>
      <header className="site-header">
        <div className="header-inner">
          <SettingsMenu
            theme={theme}
            dataMode={dataMode}
            onThemeChange={setTheme}
            onDataModeChange={changeDataMode}
            savedCount={activeSaved.length}
            onClearShortlist={() => { setSaved([]); setShortlistNotice("Shortlist cleared."); }}
            onStartDemo={startDemo}
          />
          <nav className="main-nav" aria-label="Main navigation">
            <button
              className={view === "session" ? "active" : ""}
              aria-current={view === "session" ? "page" : undefined}
              onClick={() => switchView("session")}
            >
              Decide together
            </button>
            <button
              className={view === "explore" ? "active" : ""}
              aria-current={view === "explore" ? "page" : undefined}
              onClick={() => switchView("explore")}
            >
              Explore
            </button>
            <button
              className={view === "shortlist" ? "active" : ""}
              aria-current={view === "shortlist" ? "page" : undefined}
              onClick={() => switchView("shortlist")}
            >
              Shortlist
            </button>
          </nav>
          {view !== "session" && (
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
                  : view === "shortlist"
                    ? "Saved on this device"
                    : catalogError
                      ? "Collection unavailable"
                      : "Loading collection…"}
              </span>
            </div>
          )}
        </div>
      </header>

      <main id="main-content" className="page-shell">
        {!demoActive && storageNote && <p className="v-alert" role="status">{storageNote}</p>}
        {view === "session" ? (
          <VetoSession
            key={demoActive ? `demo-${demoRun}` : "round"}
            demo={demoActive}
            saved={activeSaved}
            onSaveMovie={addSaved}
            onOpenShortlist={() => switchView("shortlist")}
            onExplore={() => switchView("explore")}
            catalogMovies={dataMode === "live" ? live.movies : undefined}
            catalogNote={dataMode === "live"
              ? catalogError || live.error || (!catalog || live.loading
                ? "Loading live movies…" : "Live movie collection.")
              : undefined}
          />
        ) : (
          <>
            <section className="hero" aria-labelledby="hero-title">
              <div className="hero-copy">
                <div className="eyebrow">THE VETO COLLECTION</div>
                <h1 id="hero-title" ref={workspaceHeadingRef} tabIndex={-1}>
                  {view === "shortlist"
                    ? "Your shortlist."
                    : "A good place to start."}
                </h1>
                <p>
                  {view === "shortlist"
                    ? "Keep a few ideas close. Each viewer can nominate a saved movie when the group is ready."
                    : "Explore real movies, compare the details, and save a few ideas for your group."}
                </p>
              </div>
              <button
                className="secondary-button"
                onClick={() => switchView("session")}
              >
                Decide together <ArrowRight size={16} />
              </button>
            </section>

            <div className={`collection-banner ${isLive ? "live-banner" : ""}`}>
              <span className="banner-icon">
                <Globe2 size={17} />
              </span>
              <p>
                {view === "shortlist" ? (
                  <>
                    <strong>Saved ideas.</strong> Available on this device for
                    your group’s nominations.
                  </>
                ) : isLive ? (
                  <>
                    <strong>You’re exploring TMDB.</strong> Live movies and
                    streaming services for your group.
                  </>
                ) : isDemo ? (
                  <>
                    <strong>Sample collection.</strong> Movie metadata and US
                    streaming listings from {CATALOG_SNAPSHOT_DATE}. Recheck
                    current playback access before nominating.
                  </>
                ) : (
                  <strong>
                    {catalogError
                      ? "Collection unavailable."
                      : "Loading collection…"}
                  </strong>
                )}
              </p>
            </div>

            <div
              className={`workspace ${view === "shortlist" ? "shortlist-workspace" : ""}`}
            >
              {view === "explore" && (
                <aside className="desktop-filters" aria-label="Movie filters">
                  {filterPanel}
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
                        ? "SAVED ON THIS DEVICE"
                        : "BROWSE & COMPARE"}
                    </div>
                    <h2 id="results-heading">
                      {view === "shortlist"
                        ? "Your shortlist"
                        : filterCount
                          ? "Matching movies"
                          : "Explore movies"}
                      <span className="result-count">
                        {loading ? "…" : total.toLocaleString()}
                      </span>
                    </h2>
                    <p className="results-description">
                      {view === "shortlist"
                        ? "Saved ideas are available for nominations in Decide together."
                        : isLive
                          ? "Live catalog results matching your filters."
                          : "Real movie records in a local sample collection."}
                    </p>
                  </div>
                  {view === "explore" && (
                    <label className="sort-control">
                      <span>Sort by</span>
                      <select
                        aria-label="Sort movies"
                        value={filters.sort}
                        onChange={(event) =>
                          changeFilters({
                            ...filters,
                            sort: event.target.value,
                          })
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
                    >
                      <SlidersHorizontal size={16} />
                      Filters {filterCount > 0 && <span>{filterCount}</span>}
                    </button>
                    <span>
                      {catalog
                        ? isLive
                          ? "Live TMDB results"
                          : "Sample collection"
                        : "Collection unavailable"} · USA
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
                            genres: filters.genres.filter(
                              (genre) => genre !== id,
                            ),
                          })
                        }
                      >
                        {genres.find((genre) => genre.id === id)?.name ||
                          "Genre"}
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
                        {providers.find(
                          (provider) => provider.provider_id === id,
                        )?.provider_name || "Service"}
                        <X size={12} />
                        <span className="sr-only">Remove filter</span>
                      </button>
                    ))}
                    {filters.language && (
                      <button
                        onClick={() =>
                          changeFilters({ ...filters, language: "" })
                        }
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
                        onClick={() =>
                          changeFilters({ ...filters, runtime: "" })
                        }
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
                        onClick={() =>
                          changeFilters({ ...filters, rating: "" })
                        }
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
                {isDemo &&
                  filters.providers.length > 0 &&
                  view === "explore" && (
                    <p className="sample-availability">
                      <Tv size={14} />
                      Streaming listings snapshot from {CATALOG_SNAPSHOT_DATE}.
                      Recheck current access in your streaming service.
                    </p>
                  )}
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
                    <h3>Couldn’t load the catalog.</h3>
                    <p>{error}</p>
                    <div className="empty-actions">
                      <button
                        className="primary-button"
                        onClick={retryCollection}
                      >
                        Try again
                      </button>

                    </div>
                  </div>
                ) : movies.length === 0 ? (
                  <div className="empty-state">
                    <Film size={36} strokeWidth={1.25} />
                    <h3>
                      {view === "shortlist"
                        ? "No saved movies yet."
                        : "No matching movies."}
                    </h3>
                    <p>
                      {view === "shortlist"
                        ? "Save a movie from Explore to make it available for nominations."
                        : isLive
                          ? "Try fewer filters or a different genre."
                          : "Try fewer filters in this sample collection."}
                    </p>
                    <button
                      className="primary-button"
                      onClick={() =>
                        view === "shortlist"
                          ? switchView("explore")
                          : changeFilters(DEFAULT_FILTERS)
                      }
                    >
                      {view === "shortlist"
                        ? "Explore movies"
                        : "Reset filters"}
                      <ArrowRight size={16} />
                    </button>
                  </div>
                ) : (
                  <div className="movie-grid">
                    {movies.map((movie) => {
                      const isSaved = activeSaved.some(
                        (item) => item.id === movie.id,
                      );
                      const movieGenres = movie.genre_ids
                        .map(
                          (id) => genres.find((genre) => genre.id === id)?.name,
                        )
                        .filter(Boolean);
                      return (
                        <article className="movie-card" key={movie.id}>
                          <div className="movie-art">
                            <button
                              className="poster-button"
                              aria-label={`View details for ${movie.title}`}
                              onClick={() => openMovie(movie)}
                            >
                              <MoviePoster movie={movie} />
                              <span className="poster-hover">
                                View details <ArrowRight size={15} />
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
                                {movie.release_date?.slice(0, 4) ||
                                  "Release TBA"}
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
                                "Genre unavailable"}
                            </p>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                )}
                {!loading &&
                  !error &&
                  view === "explore" &&
                  live.pages > 1 && (
                    <div className="pagination">
                      <button
                        className="secondary-button"
                        disabled={page === 1}
                        onClick={() => {
                          setPage((value) => value - 1);
                          setLive((previous) => ({
                            ...previous,
                            loading: true,
                          }));
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
                          setLive((previous) => ({
                            ...previous,
                            loading: true,
                          }));
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
                  view === "explore" &&
                  page >= live.pages &&
                  movies.length > 0 && (
                    <div className="collection-end">
                      <span />
                      <Film size={18} />
                      <span />
                      <p>End of the sample collection.</p>
                    </div>
                  )}
              </section>
            </div>
          </>
        )}
      </main>

      <footer className="site-footer">
        <div className="footer-main">
          <span className="footer-brand">
            <span className="footer-wordmark">veto</span> A shared choice. Every
            voice counts.
          </span>
          <span>CS422 · Functional prototype</span>
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
            {isLive
              ? "Availability can change."
              : `Prepared metadata and streaming listings from ${CATALOG_SNAPSHOT_DATE}; recheck current access.`}
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
            <MoviePoster movie={detailMovie} />
            <div className="detail-copy">
              <div className="eyebrow small">MOVIE DETAILS</div>
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
                  "No synopsis available for this movie."}
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
                {activeSaved.some((movie) => movie.id === detailMovie.id) ? (
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
                {isDemo && ` Prepared metadata from ${CATALOG_SNAPSHOT_DATE}; recheck current access.`}
              </p>
            </div>
          </div>
        </Modal>
      )}
      </div>
      {shortlistNotice && <p className="shortlist-feedback" role="status">{shortlistNotice}</p>}
      {demoActive && <DemoWalkthrough key={demoRun} onExit={exitDemo} onReplay={startDemo} />}
    </>
  );
}
