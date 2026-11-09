import { expect, test, type Page } from "@playwright/test";
import type { Catalog, Movie } from "../src/lib/tmdb";

type Mode = "demo" | "live";
const movies: Record<Mode, Movie> = {
  demo: {
    id: 910001, title: "Demo settings movie", overview: "A prepared catalog fixture.",
    release_date: "2024-01-01", original_language: "en", genre_ids: [35],
    poster_path: null, backdrop_path: null, runtime: 90,
    vote_average: 7, vote_count: 200, popularity: 10,
  },
  live: {
    id: 910002, title: "Live settings movie", overview: "A live catalog fixture.",
    release_date: "2025-01-01", original_language: "en", genre_ids: [35],
    poster_path: null, backdrop_path: null, runtime: 95,
    vote_average: 8, vote_count: 300, popularity: 20,
  },
};

const traffic = new WeakMap<Page, { credentials: string[]; upstream: string[]; errors: string[] }>();
test.beforeEach(async ({ page }) => {
  const seen = { credentials: [] as string[], upstream: [] as string[], errors: [] as string[] };
  traffic.set(page, seen);
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (url.hostname === "api.themoviedb.org") seen.upstream.push(url.href);
    if (request.headers().authorization || url.searchParams.has("api_key")) seen.credentials.push(url.href);
  });
  page.on("pageerror", (error) => seen.errors.push(error.message));
  await page.route("https://api.themoviedb.org/**", (route) => route.abort());
});
test.afterEach(async ({ page }) => {
  const seen = traffic.get(page)!;
  expect(seen.upstream, "Settings must use the application API").toEqual([]);
  expect(seen.credentials, "Browser settings must not carry server credentials").toEqual([]);
  expect(seen.errors, "Settings must not cause unhandled browser errors").toEqual([]);
});

async function fixtureServer(page: Page, options: { liveError?: string; holdLiveMovies?: boolean } = {}) {
  const calls: { path: string; mode: Mode }[] = [];
  const failed: string[] = [];
  let releaseLive!: () => void;
  let finishLive!: () => void;
  const held = new Promise<void>((resolve) => { releaseLive = resolve; });
  const finished = new Promise<void>((resolve) => { finishLive = resolve; });
  page.on("requestfailed", (request) => {
    const url = new URL(request.url());
    if (url.searchParams.get("mode") === "live") failed.push(url.pathname);
  });
  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    expect(request.method()).toBe("GET");
    expect(url.origin).toBe(new URL(page.url()).origin);
    const mode = url.searchParams.get("mode");
    expect(["demo", "live"], "Every catalog request must select a source explicitly").toContain(mode);
    if (mode !== "demo" && mode !== "live") return route.abort();
    calls.push({ path: url.pathname, mode });
    let body: unknown;
    let status = 200;
    if (url.pathname === "/api/catalog") {
      if (mode === "live" && options.liveError) {
        body = { error: options.liveError };
        status = 503;
      } else {
        body = {
          mode, genres: [{ id: 35, name: "Comedy" }],
          languages: [{ iso_639_1: "en", english_name: "English", name: "English" }],
          providers: [{ provider_id: 8, provider_name: "Netflix", logo_path: null }],
        } satisfies Catalog;
      }
    } else if (url.pathname === "/api/movies") {
      if (mode === "live" && options.holdLiveMovies) await held;
      body = { page: 1, total_pages: 1, total_results: 1, results: [movies[mode]] };
    } else if (/^\/api\/movies\/\d+$/.test(url.pathname)) {
      body = movies[mode];
    } else {
      status = 404;
      body = { error: "Unexpected settings-test API path." };
    }
    if (mode === "live" && options.holdLiveMovies && url.pathname === "/api/movies") {
      try {
        await route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
      } catch {
        // Switching back deliberately cancels this held request.
      } finally {
        finishLive();
      }
    } else {
      await route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
    }
  });
  return { calls, failed, releaseLive, finished };
}

async function openSettings(page: Page) {
  const menu = page.getByRole("menu");
  if (!(await menu.isVisible())) await page.getByRole("button", { name: "Veto settings", exact: true }).click();
  await expect(menu).toBeVisible();
  return menu;
}

async function toggleLive(page: Page) {
  const menu = await openSettings(page);
  await menu.getByRole("menuitemcheckbox", { name: "Live data", exact: true }).click();
  await page.keyboard.press("Escape");
}

const card = (page: Page, mode: Mode) =>
  page.getByRole("button", { name: `View details for ${movies[mode].title}`, exact: true });

test("logo settings support keyboard dismissal, outside clicks, and persistent theme/source preferences", async ({ page }) => {
  await fixtureServer(page);
  await page.goto("/");
  await page.getByLabel("Viewer 1 name").fill("Settings viewer");
  const logo = page.getByRole("button", { name: "Veto settings", exact: true });
  await logo.focus();
  await page.keyboard.press("ArrowDown");
  const menu = page.getByRole("menu");
  const dark = menu.getByRole("menuitemcheckbox", { name: "Dark mode", exact: true });
  const live = menu.getByRole("menuitemcheckbox", { name: "Live data", exact: true });
  await expect(dark).toBeFocused();
  await expect(dark).toHaveAttribute("aria-checked", "false");
  await expect(live).toHaveAttribute("aria-checked", "false");
  await page.keyboard.press("ArrowDown");
  await expect(live).toBeFocused();
  await page.keyboard.press("Home");
  await expect(dark).toBeFocused();
  await page.keyboard.press("End");
  await expect(menu.getByRole("menuitem", { name: "Start demo", exact: true })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(menu).toBeHidden();
  await expect(logo).toBeFocused();

  await page.keyboard.press("Enter");
  await expect(menu).toBeVisible();
  await dark.click();
  await expect(dark).toHaveAttribute("aria-checked", "true");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await live.click();
  await expect(live).toHaveAttribute("aria-checked", "true");
  await page.keyboard.press("Tab");
  await expect(menu).toBeHidden();
  await openSettings(page);
  const name = page.getByLabel("Viewer 1 name");
  await name.click();
  await expect(menu).toBeHidden();
  await expect(name).toBeFocused();
  await expect(name).toHaveValue("Settings viewer");
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem("veto-preferences-v1") || "null"))).toEqual({ theme: "dark", dataMode: "live" });

  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(page.getByLabel("Viewer 1 name")).toHaveValue("Settings viewer");
  await openSettings(page);
  await expect(dark).toHaveAttribute("aria-checked", "true");
  await expect(live).toHaveAttribute("aria-checked", "true");
  await dark.click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
});

test("switching data sources refetches catalog, list, and details with explicit source mode", async ({ page }) => {
  const fixture = await fixtureServer(page);
  await page.goto("/");
  await page.getByRole("button", { name: "Explore", exact: true }).click();
  await expect(card(page, "demo")).toBeVisible();
  expect(fixture.calls.some((call) => call.path === "/api/catalog" && call.mode === "demo")).toBe(true);
  await toggleLive(page);
  await expect(card(page, "live")).toBeVisible();
  await expect(card(page, "demo")).toHaveCount(0);
  await card(page, "live").click();
  const details = page.getByRole("dialog", { name: movies.live.title, exact: true });
  await expect(details).toContainText("95 min");
  expect(fixture.calls).toContainEqual({ path: `/api/movies/${movies.live.id}`, mode: "live" });
  await details.getByRole("button", { name: `Close ${movies.live.title}`, exact: true }).click();
  await toggleLive(page);
  await expect(card(page, "demo")).toBeVisible();
  await expect(card(page, "live")).toHaveCount(0);
  expect(fixture.calls.filter((call) => call.path === "/api/catalog" && call.mode === "demo").length).toBeGreaterThanOrEqual(2);
});

test("live errors remain visible without silent fallback and switching to demo recovers", async ({ page }) => {
  const error = "Live catalog unavailable in this test.";
  const fixture = await fixtureServer(page, { liveError: error });
  await page.goto("/");
  await page.getByRole("button", { name: "Explore", exact: true }).click();
  await expect(card(page, "demo")).toBeVisible();
  await toggleLive(page);
  await expect(page.getByRole("alert").filter({ hasText: error })).toBeVisible();
  await expect(card(page, "demo")).toHaveCount(0);
  await expect(card(page, "live")).toHaveCount(0);
  await page.getByRole("button", { name: "Try again", exact: true }).click();
  await expect.poll(() => fixture.calls.filter((call) => call.path === "/api/catalog" && call.mode === "live").length).toBeGreaterThanOrEqual(2);
  await openSettings(page);
  await expect(page.getByRole("menuitemcheckbox", { name: "Live data", exact: true })).toHaveAttribute("aria-checked", "true");
  await toggleLive(page);
  await expect(card(page, "demo")).toBeVisible();
  await expect(page.getByRole("alert").filter({ hasText: error })).toHaveCount(0);
});

test("switching back to demo cancels a pending live result and prevents stale movies", async ({ page }) => {
  const fixture = await fixtureServer(page, { holdLiveMovies: true });
  try {
    await page.goto("/");
    await page.getByRole("button", { name: "Explore", exact: true }).click();
    await expect(card(page, "demo")).toBeVisible();
    await toggleLive(page);
    await expect.poll(() => fixture.calls.some((call) => call.path === "/api/movies" && call.mode === "live")).toBe(true);
    await toggleLive(page);
    await expect(card(page, "demo")).toBeVisible();
    fixture.releaseLive();
    await fixture.finished;
    await expect.poll(() => fixture.failed.includes("/api/movies")).toBe(true);
    await expect(card(page, "live")).toHaveCount(0);
    await expect(card(page, "demo")).toBeVisible();
    await expect(page.locator("#movies")).toHaveAttribute("aria-busy", "false");
  } finally {
    fixture.releaseLive();
  }
});
