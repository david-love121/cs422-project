import { test, expect, type Page } from "@playwright/test";
import {
  DEMO_GENRES,
  DEMO_LANGUAGES,
  DEMO_MOVIES,
  DEMO_PROVIDERS,
  filterDemoMovies,
} from "../src/lib/demo";
import { DEFAULT_FILTERS, type Filters } from "../src/lib/tmdb";

async function openFilters(page: Page, mobile: boolean) {
  if (mobile) await page.getByRole("button", { name: /^Filters/ }).click();
  return mobile
    ? page.getByRole("dialog", { name: "Your movie preferences" })
    : page.locator("aside");
}

async function closeFilters(page: Page, mobile: boolean) {
  if (mobile)
    await page
      .getByRole("button", { name: "Show movies", exact: true })
      .click();
}

const movie = {
  id: 700001,
  title: "Server Test Movie",
  original_language: "en",
  genre_ids: [16, 35],
  release_date: "2024-01-01",
  vote_average: 8,
  vote_count: 1000,
  popularity: 100,
  poster_path: null,
  backdrop_path: null,
  overview: "A movie supplied through the app’s same-origin server endpoint.",
};

const traffic = new WeakMap<
  Page,
  { directTmdb: string[]; authorized: string[]; keyInUrl: string[] }
>();

test.beforeEach(async ({ page }) => {
  const seen = {
    directTmdb: [] as string[],
    authorized: [] as string[],
    keyInUrl: [] as string[],
  };
  traffic.set(page, seen);
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (url.hostname === "api.themoviedb.org")
      seen.directTmdb.push(url.toString());
    if (request.headers().authorization) seen.authorized.push(url.toString());
    if (url.searchParams.has("api_key")) seen.keyInUrl.push(url.toString());
  });
  await page.route("https://api.themoviedb.org/**", (route) => route.abort());
});

test.afterEach(async ({ page }) => {
  const seen = traffic.get(page)!;
  expect(seen.directTmdb, "The browser must not call the TMDB API").toEqual([]);
  expect(
    seen.authorized,
    "No browser request should carry the server credential",
  ).toEqual([]);
  expect(seen.keyInUrl, "No browser URL should contain an API key").toEqual([]);
});

type FixtureOptions = {
  mode?: "live" | "demo";
  empty?: boolean;
  catalogFailures?: number;
  discoveryFailures?: number;
};

async function mockServer(page: Page, options: FixtureOptions = {}) {
  const calls = { catalog: 0, discovery: [] as URL[], details: [] as URL[] };
  const mode = options.mode ?? "live";
  await page.route("**/api/**", async (route) => {
    const url = new URL(route.request().url());
    expect(url.origin).toBe(new URL(page.url()).origin);
    expect(route.request().method()).toBe("GET");
    let body: unknown;
    let status = 200;
    if (url.pathname === "/api/catalog") {
      calls.catalog += 1;
      if (calls.catalog <= (options.catalogFailures ?? 0)) {
        status = 503;
        body = {
          error:
            "The movie catalog is temporarily unavailable. Please try again.",
        };
      } else {
        body = {
          mode,
          genres: DEMO_GENRES,
          languages: DEMO_LANGUAGES,
          providers: DEMO_PROVIDERS,
        };
      }
    } else if (url.pathname === "/api/movies") {
      calls.discovery.push(url);
      if (calls.discovery.length <= (options.discoveryFailures ?? 0)) {
        status = 503;
        body = {
          error: "Movies are temporarily unavailable. Please try again.",
        };
      } else {
        const q = url.searchParams;
        const filters: Filters = {
          ...DEFAULT_FILTERS,
          genres: q.get("genres")?.split(",").filter(Boolean).map(Number) ?? [],
          genreMode: q.get("genreMode") === "all" ? "all" : "any",
          language: q.get("language") ?? "",
          runtime: q.get("runtime") ?? "",
          year: q.get("year") ?? "",
          rating: q.get("rating") ?? "",
          sort: q.get("sort") ?? DEFAULT_FILTERS.sort,
          providers:
            q.get("providers")?.split(",").filter(Boolean).map(Number) ?? [],
        };
        const results = options.empty
          ? []
          : mode === "demo"
            ? filterDemoMovies(filters)
            : [movie];
        body = {
          page: 1,
          total_pages: results.length ? 1 : 0,
          total_results: results.length,
          results,
        };
      }
    } else if (/^\/api\/movies\/\d+$/.test(url.pathname)) {
      calls.details.push(url);
      const id = Number(url.pathname.split("/").at(-1));
      body =
        mode === "demo"
          ? DEMO_MOVIES.find((item) => item.id === id)
          : { ...movie, runtime: 85 };
    } else {
      status = 404;
      body = { error: "Unexpected endpoint in the browser test." };
    }
    await route.fulfill({
      status,
      contentType: "application/json",
      body: JSON.stringify(body),
    });
  });
  return calls;
}

test("sample mode filters, resets, and preserves the shortlist after reload", async ({
  page,
  isMobile,
}) => {
  await mockServer(page, { mode: "demo" });
  await page.goto("/");
  await page.getByRole("button", { name: "Explore", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: /A good place to start/ }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "View details for Soul", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Sample collection.", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Connect TMDB", exact: true }),
  ).toHaveCount(0);
  const filters = await openFilters(page, isMobile);
  await filters.getByRole("button", { name: "Animation", exact: true }).click();
  await expect(
    filters.getByRole("button", { name: "Animation", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await closeFilters(page, isMobile);
  await expect(
    page.getByRole("button", { name: "View details for Soul", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", {
      name: "View details for Interstellar",
      exact: true,
    }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Save Soul", exact: true }).click();
  await page.reload();
  await page.getByRole("button", { name: /^Shortlist/ }).click();
  await expect(
    page.getByRole("button", { name: "View details for Soul", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", {
      name: "Remove Soul from shortlist",
      exact: true,
    }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Explore", exact: true }).click();
  const resetFilters = await openFilters(page, isMobile);
  await resetFilters
    .getByRole("button", { name: "Reset filters", exact: true })
    .click();
  await closeFilters(page, isMobile);
  await expect(
    page.getByRole("button", {
      name: "View details for Interstellar",
      exact: true,
    }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth + 1,
    ),
  ).toBe(false);
});

test("live filters and details use only the app server with no browser credential", async ({
  page,
  isMobile,
}) => {
  const calls = await mockServer(page);
  await page.goto("/");
  await page.getByRole("button", { name: "Explore", exact: true }).click();
  await expect(
    page.getByRole("button", {
      name: "View details for Server Test Movie",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByText("You’re exploring TMDB.", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Connect TMDB", exact: true }),
  ).toHaveCount(0);
  await expect(page.getByLabel("TMDB read token or API key")).toHaveCount(0);
  const filters = await openFilters(page, isMobile);
  await filters.getByRole("button", { name: "Animation", exact: true }).click();
  await filters.getByRole("button", { name: "Comedy", exact: true }).click();
  await filters
    .getByRole("checkbox", { name: "Must include every selected genre" })
    .check();
  await filters
    .getByRole("combobox", { name: "Original language", exact: true })
    .selectOption("en");
  await filters
    .getByRole("combobox", { name: "Movie length", exact: true })
    .selectOption("short");
  await filters
    .getByRole("combobox", { name: "Release decade", exact: true })
    .selectOption("2020");
  await filters
    .getByRole("combobox", { name: "Minimum rating", exact: true })
    .selectOption("7");
  await filters.getByRole("button", { name: "Netflix", exact: true }).click();
  await filters
    .getByRole("button", { name: "Amazon Prime Video", exact: true })
    .click();
  await closeFilters(page, isMobile);
  await page
    .getByRole("combobox", { name: "Sort movies", exact: true })
    .selectOption("vote_average.desc");
  await expect
    .poll(() =>
      calls.discovery.some((url) => {
        const q = url.searchParams;
        return (
          q.get("genres") === "16,35" &&
          q.get("genreMode") === "all" &&
          q.get("language") === "en" &&
          q.get("runtime") === "short" &&
          q.get("year") === "2020" &&
          q.get("rating") === "7" &&
          q.get("providers") === "8,9" &&
          q.get("sort") === "vote_average.desc" &&
          !q.has("page")
        );
      }),
    )
    .toBe(true);
  await page
    .getByRole("button", {
      name: "View details for Server Test Movie",
      exact: true,
    })
    .click();
  await expect(
    page.getByRole("dialog", { name: "Server Test Movie" }),
  ).toContainText("85 min");
  expect(calls.details.map((url) => url.pathname)).toContain(
    "/api/movies/700001",
  );
  expect(calls.catalog).toBeGreaterThan(0);
});

test("catalog bootstrap failure can be retried without accepting a browser API key", async ({
  page,
}) => {
  const calls = await mockServer(page, { catalogFailures: 1 });
  await page.goto("/");
  await page.getByRole("button", { name: "Explore", exact: true }).click();
  await expect(
    page.getByText(
      "The movie catalog is temporarily unavailable. Please try again.",
      { exact: true },
    ),
  ).toBeVisible();
  expect(calls.discovery).toHaveLength(0);
  await page.getByRole("button", { name: "Try again", exact: true }).click();
  await expect(
    page.getByRole("button", {
      name: "View details for Server Test Movie",
      exact: true,
    }),
  ).toBeVisible();
  expect(calls.catalog).toBeGreaterThanOrEqual(2);
  await expect(
    page.getByRole("button", { name: "Connect TMDB", exact: true }),
  ).toHaveCount(0);
});

test("discovery failure recovers using the retry action", async ({ page }) => {
  const calls = await mockServer(page, { discoveryFailures: 1 });
  await page.goto("/");
  await page.getByRole("button", { name: "Explore", exact: true }).click();
  await expect(
    page.getByText("Movies are temporarily unavailable. Please try again.", {
      exact: true,
    }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Try again", exact: true }).click();
  await expect(
    page.getByRole("button", {
      name: "View details for Server Test Movie",
      exact: true,
    }),
  ).toBeVisible();
  expect(calls.discovery.length).toBeGreaterThanOrEqual(2);
  await expect(page.locator("#movies")).toHaveAttribute("aria-busy", "false");
});

test("empty results and resetting unchanged filters remain usable", async ({
  page,
  isMobile,
}) => {
  await mockServer(page, { empty: true });
  await page.goto("/");
  await page.getByRole("button", { name: "Explore", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "No matching movies." }),
  ).toBeVisible();
  const filters = await openFilters(page, isMobile);
  await filters
    .getByRole("button", { name: "Reset filters", exact: true })
    .click();
  await closeFilters(page, isMobile);
  await expect(
    page.getByRole("heading", { name: "No matching movies." }),
  ).toBeVisible();
  await expect(page.locator("#movies")).toHaveAttribute("aria-busy", "false");
});

test("a saved server movie can be nominated in Veto after its access check", async ({ page }) => {
  await mockServer(page);
  await page.goto("/");
  await page.getByRole("button", { name: "Explore", exact: true }).click();
  await page.getByRole("button", { name: "View details for Server Test Movie", exact: true }).click();
  const details = page.getByRole("dialog", { name: "Server Test Movie", exact: true });
  await expect(details).toContainText("85 min");
  await details.getByRole("button", { name: "Add to shortlist", exact: true }).click();
  await details.getByRole("button", { name: "Close Server Test Movie", exact: true }).click();
  await page.getByRole("button", { name: "Decide together", exact: true }).first().click();
  await page.getByLabel("Number of viewers").selectOption("2");
  await page.getByRole("button", { name: "Continue to suggestions", exact: true }).click();
  await page.getByRole("searchbox", { name: "Find a movie", exact: true }).fill(movie.title);
  await page.getByRole("button", { name: /^Server Test Movie 2024/ }).click();
  const access = page.getByRole("dialog", { name: movie.title, exact: true });
  await expect(access.getByLabel("Runtime in minutes")).toHaveValue("85");
  const add = access.getByRole("button", { name: "Add my suggestion", exact: true });
  await expect(add).toBeDisabled();
  await access.getByLabel("I checked playback access and audio on this service, including subtitle needs. There is no extra charge.").check();
  await add.click();
  await expect(access).toHaveCount(0);
  await expect(page.locator(".v-shortlist-item").filter({ hasText: movie.title })).toBeVisible();
});

test("retiring a browser token preserves the existing shortlist and sends no credential", async ({ page }) => {
  await mockServer(page);
  await page.addInitScript((savedMovie) => {
    sessionStorage.setItem("movie-night-tmdb-token", "retired-browser-token");
    localStorage.setItem("movie-night-shortlist-v1", JSON.stringify([savedMovie]));
  }, movie);
  await page.goto("/");
  await page.getByRole("button", { name: "Shortlist", exact: true }).click();
  await expect(page.getByRole("button", { name: `View details for ${movie.title}`, exact: true })).toBeVisible();
  await expect.poll(() => page.evaluate(() => sessionStorage.getItem("movie-night-tmdb-token"))).toBeNull();
});
