import {
  test,
  expect,
  type APIRequestContext,
  type APIResponse,
} from "@playwright/test";
import type { Catalog, Movie, MoviePage } from "../src/lib/tmdb";

async function sampleCatalog(request: APIRequestContext): Promise<Catalog> {
  const response = await request.get("/api/catalog?mode=demo");
  expect(response.status()).toBe(200);
  const catalog = (await response.json()) as Catalog;
  expect(catalog.mode).toBe("demo");
  return catalog;
}

function expectSharedCache(response: APIResponse, seconds: number) {
  const headers = response.headers();
  expect(headers["cache-control"]).toBe(
    `public, max-age=0, s-maxage=${seconds}, stale-while-revalidate=60`,
  );
  for (const name of ["cdn-cache-control", "vercel-cdn-cache-control"])
    expect(headers[name]).toBe(
      `public, s-maxage=${seconds}, stale-while-revalidate=60`,
    );
  expect(headers["x-content-type-options"]).toBe("nosniff");
}

test("real sample GET handlers return catalog, filtered movies, details, and shared-cache policies", async ({
  request,
}) => {
  const catalog = await sampleCatalog(request);
  expect(catalog.genres.length).toBeGreaterThan(0);
  expect(catalog.languages.length).toBeGreaterThan(0);
  expect(catalog.providers.length).toBeGreaterThan(0);
  expectSharedCache(await request.get("/api/catalog?mode=demo"), 86_400);

  const landingResponse = await request.get("/api/movies?mode=demo");
  expect(landingResponse.status()).toBe(200);
  expectSharedCache(landingResponse, 900);
  const landing = (await landingResponse.json()) as MoviePage;
  expect(landing.page).toBe(1);
  expect(landing.results.length).toBeGreaterThan(0);
  expect(landing.total_results).toBeGreaterThanOrEqual(landing.results.length);

  if (landing.total_pages > 1) {
    const nextResponse = await request.get("/api/movies?mode=demo&page=2");
    expect(nextResponse.status()).toBe(200);
    expectSharedCache(nextResponse, 300);
    const nextPage = (await nextResponse.json()) as MoviePage;
    expect(nextPage.page).toBe(2);
    expect(nextPage.total_results).toBe(landing.total_results);
    expect(nextPage.results.length).toBeGreaterThan(0);
    for (const item of nextPage.results)
      expect(landing.results.some((firstPageMovie) => firstPageMovie.id === item.id)).toBe(false);
  }

  const movie = landing.results[0];
  const filteredResponse = await request.get(
    `/api/movies?mode=demo&genres=${movie.genre_ids[0]}&language=${movie.original_language}`,
  );
  expect(filteredResponse.status()).toBe(200);
  expectSharedCache(filteredResponse, 300);
  const filtered = (await filteredResponse.json()) as MoviePage;
  expect(filtered.results.some((item) => item.id === movie.id)).toBe(true);
  for (const item of filtered.results) {
    expect(item.genre_ids).toContain(movie.genre_ids[0]);
    expect(item.original_language).toBe(movie.original_language);
  }

  const detailResponse = await request.get(`/api/movies/${movie.id}?mode=demo`);
  expect(detailResponse.status()).toBe(200);
  expectSharedCache(detailResponse, 21_600);
  const detail = (await detailResponse.json()) as Movie;
  expect(detail.id).toBe(movie.id);
  expect(detail.title).toBe(movie.title);
  expect(detail.runtime).toBeGreaterThan(0);
});

test("real API handlers reject invalid queries and movie IDs with uncached JSON errors", async ({
  request,
}) => {
  await sampleCatalog(request);
  for (const [path, status] of [
    ["/api/catalog?region=US", 400],
    ["/api/catalog?mode=", 400],
    ["/api/catalog?mode=demo&mode=live", 400],
    ["/api/movies?mode=invalid", 400],
    ["/api/movies?mode=demo&mode=demo", 400],
    ["/api/movies/508442?mode=invalid", 400],
    ["/api/movies/508442?mode=demo&mode=live", 400],
    ["/api/movies?runtime=90", 400],
    ["/api/movies?api_key=visitor-credential", 400],
    ["/api/movies?genres=35&genres=16", 400],
    ["/api/movies/not-a-number", 400],
    ["/api/movies/0", 400],
    ["/api/movies/2147483647?mode=demo", 404],
    ["/api/movies/508442?language=en", 400],
  ] as const) {
    const response = await request.get(path);
    expect(response.status(), path).toBe(status);
    expect(response.headers()["content-type"]).toContain("application/json");
    for (const name of [
      "cache-control",
      "cdn-cache-control",
      "vercel-cdn-cache-control",
    ])
      expect(response.headers()[name], `${path}: ${name}`).toBe("no-store");
    const body = (await response.json()) as { error: string };
    expect(body.error).toEqual(expect.any(String));
    expect(body.error.length).toBeGreaterThan(0);
    expect(JSON.stringify(body)).not.toContain("visitor-credential");
  }
});

test("the browser renders and saves movies from the real sample API without interception", async ({
  page,
  request,
}) => {
  await sampleCatalog(request);
  const directTmdb: string[] = [];
  const credentials: string[] = [];
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("request", (outgoing) => {
    const url = new URL(outgoing.url());
    if (url.hostname === "api.themoviedb.org") directTmdb.push(url.href);
    if (url.searchParams.has("api_key") || outgoing.headers().authorization)
      credentials.push(url.href);
  });

  const listResponse = page.waitForResponse(
    (response) => new URL(response.url()).pathname === "/api/movies",
  );
  await page.goto("/");
  await page.getByRole("button", { name: "Explore", exact: true }).click();
  const listing = await listResponse;
  expect(listing.status()).toBe(200);
  const movies = (await listing.json()) as MoviePage;
  const movie = movies.results[0];
  await expect(
    page.getByRole("button", {
      name: `View details for ${movie.title}`,
      exact: true,
    }),
  ).toBeVisible();

  const detailResponse = page.waitForResponse(
    (response) => new URL(response.url()).pathname === `/api/movies/${movie.id}`,
  );
  await page
    .getByRole("button", {
      name: `View details for ${movie.title}`,
      exact: true,
    })
    .click();
  const detail = (await (await detailResponse).json()) as Movie;
  const dialog = page.getByRole("dialog", { name: movie.title, exact: true });
  await expect(dialog).toContainText(`${detail.runtime} min`);
  await dialog
    .getByRole("button", { name: "Add to shortlist", exact: true })
    .click();
  await dialog
    .getByRole("button", { name: `Close ${movie.title}`, exact: true })
    .click();
  await page.getByRole("button", { name: "Shortlist", exact: true }).click();
  await expect(
    page.getByRole("button", {
      name: `Remove ${movie.title} from shortlist`,
      exact: true,
    }),
  ).toBeVisible();
  expect(directTmdb).toEqual([]);
  expect(credentials).toEqual([]);
  expect(pageErrors).toEqual([]);
});
