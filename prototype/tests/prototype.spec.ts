import { test, expect, type Page } from "@playwright/test";

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
async function connect(page: Page, token = "test-read-token") {
  await page
    .getByRole("button", { name: "Connect TMDB", exact: true })
    .first()
    .click();
  const connection = page.getByRole("dialog", { name: "Connect to TMDB" });
  await connection.getByLabel("TMDB read token or API key").fill(token);
  await connection
    .getByRole("button", { name: "Connect", exact: true })
    .click();
}

test("genre filtering, reset, and shortlist survive reload", async ({
  page,
  isMobile,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Explore", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: /A good place to start/ }),
  ).toBeVisible();
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

const movie = {
  id: 700001,
  title: "Browser Test Movie",
  original_language: "en",
  genre_ids: [16],
  release_date: "2024-01-01",
  vote_average: 8,
  vote_count: 1000,
  popularity: 100,
  poster_path: null,
  backdrop_path: null,
  overview:
    "A movie returned directly to this browser by the TMDB test fixture.",
};

async function mockTmdb(page: Page, discovery: URL[], empty = false) {
  await page.route("https://api.themoviedb.org/3/**", async (route) => {
    const url = new URL(route.request().url());
    expect(route.request().headers().authorization).toBe(
      "Bearer test-read-token",
    );
    let body: unknown;
    if (url.pathname.endsWith("/genre/movie/list"))
      body = { genres: [{ id: 16, name: "Animation" }] };
    else if (url.pathname.endsWith("/configuration/languages"))
      body = [{ iso_639_1: "en", english_name: "English", name: "English" }];
    else if (url.pathname.endsWith("/watch/providers/movie")) {
      expect(url.searchParams.get("watch_region")).toBe("US");
      body = {
        results: [
          {
            provider_id: 8,
            provider_name: "Netflix",
            logo_path: null,
            display_priority: 0,
          },
        ],
      };
    } else if (url.pathname.endsWith("/discover/movie")) {
      discovery.push(url);
      body = {
        page: 1,
        total_pages: empty ? 0 : 1,
        total_results: empty ? 0 : 1,
        results: empty ? [] : [movie],
      };
    } else
      body = { ...movie, runtime: 85, genres: [{ id: 16, name: "Animation" }] };
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(body),
    });
  });
}

test("browser sends category and US streaming filters directly to TMDB", async ({
  page,
  isMobile,
}) => {
  const discovery: URL[] = [];
  await mockTmdb(page, discovery);
  await page.goto("/");
  await page.getByRole("button", { name: "Explore", exact: true }).click();
  await connect(page);
  await expect(
    page.getByRole("button", {
      name: "View details for Browser Test Movie",
      exact: true,
    }),
  ).toBeVisible();
  const filters = await openFilters(page, isMobile);
  await filters.getByRole("button", { name: "Animation", exact: true }).click();
  await filters
    .getByRole("combobox", { name: "Original language", exact: true })
    .selectOption("en");
  await filters
    .getByRole("combobox", { name: "Movie length", exact: true })
    .selectOption("short");
  await filters.getByRole("button", { name: "Netflix", exact: true }).click();
  await closeFilters(page, isMobile);
  await expect
    .poll(() =>
      discovery.some((url) => {
        const q = url.searchParams;
        return (
          q.get("with_genres") === "16" &&
          q.get("with_original_language") === "en" &&
          q.get("with_watch_providers") === "8" &&
          q.get("watch_region") === "US" &&
          q.get("with_runtime.gte") === "1" &&
          q.get("with_runtime.lte") === "90" &&
          q.get("with_watch_monetization_types") === "flatrate|free|ads"
        );
      }),
    )
    .toBe(true);
  await page
    .getByRole("button", {
      name: "View details for Browser Test Movie",
      exact: true,
    })
    .click();
  await expect(
    page.getByRole("dialog", { name: "Browser Test Movie" }),
  ).toContainText("85 min");
});

test("rejected TMDB credentials show a recoverable error", async ({ page }) => {
  await page.route("https://api.themoviedb.org/3/**", (route) =>
    route.fulfill({
      status: 401,
      contentType: "application/json",
      body: JSON.stringify({
        success: false,
        status_code: 7,
        status_message: "Invalid API key",
      }),
    }),
  );
  await page.goto("/");
  await page.getByRole("button", { name: "Explore", exact: true }).click();
  await connect(page, "invalid-test-token");
  await expect(
    page.getByRole("dialog", { name: "Connect to TMDB" }).getByRole("alert"),
  ).toContainText("did not accept that credential");
  await expect(
    page.getByRole("dialog", { name: "Connect to TMDB" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Keep exploring the sample collection" })
    .click();
  await expect(
    page.getByRole("button", { name: "View details for Soul", exact: true }),
  ).toBeVisible();
});

test("empty live results and unchanged filter reset stay usable", async ({
  page,
  isMobile,
}) => {
  await mockTmdb(page, [], true);
  await page.goto("/");
  await page.getByRole("button", { name: "Explore", exact: true }).click();
  await connect(page);
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
