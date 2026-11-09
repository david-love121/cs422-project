import { test, expect, type Page } from "@playwright/test";
import {
  DEMO_GENRES,
  DEMO_LANGUAGES,
  DEMO_MOVIES,
  DEMO_PROVIDERS,
  filterDemoMovies,
} from "../src/lib/demo";
import { DEFAULT_FILTERS, type Filters, type Provider } from "../src/lib/tmdb";
import { MAX_FILTER_IDS } from "../src/lib/catalog";

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
  providers?: Provider[];
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
          providers: options.providers ?? DEMO_PROVIDERS,
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

test("a saved server movie joins the round directly with its known runtime", async ({ page }) => {
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
  await page.getByLabel("Viewer 2 name").fill("Sam");
  await page.getByRole("button", { name: "Continue to suggestions", exact: true }).click();
  await page.getByRole("searchbox", { name: "Find a movie", exact: true }).fill(movie.title);
  await page.getByRole("button", { name: /^Server Test Movie 2024/ }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  const candidate = page.locator(".v-shortlist-item").filter({ hasText: movie.title });
  await expect(candidate).toBeVisible();
  await expect(candidate).toContainText("85 min");
  await expect(page.getByRole("heading", { name: "Sam, add your suggestion.", exact: true })).toBeVisible();
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

test("catalog requests begin on Explore and remain loaded across workspace navigation", async ({ page }) => {
  const calls = await mockServer(page);
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Who’s watching?", exact: true })).toBeVisible();
  expect(calls.catalog).toBe(0);
  expect(calls.discovery).toHaveLength(0);
  await page.getByRole("button", { name: "Shortlist", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Your shortlist.", exact: true })).toBeVisible();
  expect(calls.catalog).toBe(0);
  await page.getByRole("button", { name: "Explore", exact: true }).click();
  await expect(page.getByRole("button", { name: `View details for ${movie.title}`, exact: true })).toBeVisible();
  expect(calls.catalog).toBe(1);
  const discoveries = calls.discovery.length;
  await page.getByRole("button", { name: "Decide together", exact: true }).first().click();
  await expect(page.getByRole("heading", { name: "Who’s watching?", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Explore", exact: true }).click();
  await expect(page.getByRole("button", { name: `View details for ${movie.title}`, exact: true })).toBeVisible();
  expect(calls.catalog).toBe(1);
  expect(calls.discovery).toHaveLength(discoveries);
});

test("saving a 101st movie keeps all saved titles after reload", async ({ page }) => {
  await mockServer(page);
  await page.addInitScript((fixture) => {
    if (sessionStorage.getItem("seeded-large-shortlist")) return;
    const saved = Array.from({ length: 100 }, (_, index) => ({
      ...fixture, id: 800000 + index, title: `Earlier saved movie ${index + 1}`,
    }));
    localStorage.setItem("movie-night-shortlist-v1", JSON.stringify(saved));
    sessionStorage.setItem("seeded-large-shortlist", "yes");
  }, movie);
  await page.goto("/");
  await page.getByRole("button", { name: "Explore", exact: true }).click();
  await page.getByRole("button", { name: `Save ${movie.title}`, exact: true }).click();
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem("movie-night-shortlist-v1") || "[]").length)).toBe(101);
  await page.reload();
  await page.getByRole("button", { name: "Shortlist", exact: true }).click();
  await expect(page.getByRole("button", { name: /^View details for / })).toHaveCount(101);
  await expect(page.getByRole("button", { name: `View details for ${movie.title}`, exact: true })).toBeVisible();
});

test("partial legacy saved movies open safely even when detail lookup fails", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await mockServer(page);
  await page.route(/\/api\/movies\/123(?:\?.*)?$/, (route) => route.fulfill({
    status: 404, contentType: "application/json", body: JSON.stringify({ error: "This movie is no longer available." }),
  }));
  await page.addInitScript(() => localStorage.setItem("movie-night-shortlist-v1", JSON.stringify([
    { id: 123, title: "Legacy saved movie", vote_average: "bad", genre_ids: null, poster_path: 99 },
    { id: -1, title: "Invalid identity" }, null,
  ])));
  await page.goto("/");
  await page.getByRole("button", { name: "Shortlist", exact: true }).click();
  await expect(page.getByRole("button", { name: /^View details for / })).toHaveCount(1);
  await page.getByRole("button", { name: "View details for Legacy saved movie", exact: true }).click();
  const details = page.getByRole("dialog", { name: "Legacy saved movie", exact: true });
  await expect(details).toContainText("No synopsis available for this movie.");
  await expect(details).toContainText("This movie is no longer available.");
  await expect(details).toContainText("0.0");
  expect(errors).toEqual([]);
});

test("failed shortlist writes keep the current idea usable and explain the persistence limit", async ({ page }) => {
  await mockServer(page);
  await page.addInitScript(() => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (this === localStorage && key === "movie-night-shortlist-v1")
        throw new DOMException("Storage full", "QuotaExceededError");
      original.call(this, key, value);
    };
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Explore", exact: true }).click();
  await page.getByRole("button", { name: `Save ${movie.title}`, exact: true }).click();
  await page.getByRole("button", { name: "Shortlist", exact: true }).click();
  await expect(page.getByRole("button", { name: `View details for ${movie.title}`, exact: true })).toBeVisible();
  await expect(page.getByText("Changes to your shortlist couldn’t be saved on this device. Keep this page open; reloading may lose them.", { exact: true })).toBeVisible();
});

test("streaming selection stops at the server limit and permits replacing a selected service", async ({ page, isMobile }) => {
  const providers = Array.from({ length: MAX_FILTER_IDS + 1 }, (_, index) => ({
    provider_id: 1000 + index, provider_name: `Test service ${index + 1}`, logo_path: null,
  }));
  const calls = await mockServer(page, { providers });
  await page.goto("/");
  await page.getByRole("button", { name: "Explore", exact: true }).click();
  await expect(page.getByRole("button", { name: `View details for ${movie.title}`, exact: true })).toBeVisible();
  const filters = await openFilters(page, isMobile);
  await filters.getByRole("button", { name: "All streaming services", exact: true }).click();
  for (let index = 1; index <= MAX_FILTER_IDS; index++)
    await filters.getByRole("button", { name: `Test service ${index}`, exact: true }).click();
  const extra = filters.getByRole("button", { name: `Test service ${MAX_FILTER_IDS + 1}`, exact: true });
  await expect(extra).toBeDisabled();
  await expect(filters.getByText(`Up to ${MAX_FILTER_IDS} streaming services can be selected. Remove one to choose another.`, { exact: true })).toBeVisible();
  await filters.getByRole("button", { name: "Test service 1", exact: true }).click();
  await expect(extra).toBeEnabled();
  await extra.click();
  await closeFilters(page, isMobile);
  await expect.poll(() => calls.discovery.at(-1)?.searchParams.get("providers")?.split(",").length).toBe(MAX_FILTER_IDS);
  expect(calls.discovery.every((url) => (url.searchParams.get("providers")?.split(",").length ?? 0) <= MAX_FILTER_IDS)).toBe(true);
});
