import assert from "node:assert/strict";
import { test } from "node:test";
import { DEFAULT_FILTERS, buildDiscoverUrl } from "../src/lib/tmdb";
import { fetchMovies as fetchClientMovies } from "../src/lib/tmdb-client";
import {
  ApiError,
  CACHE_SECONDS,
  errorResponse,
  movieCacheSeconds,
  parseMovieId,
  parseMovieQuery,
  requireNoQuery,
  sharedCacheHeaders,
} from "../src/lib/server/query";
import { createMovieService } from "../src/lib/server/tmdb-service";

const fixtureMovie = {
  id: 123,
  title: "A server fixture",
  overview: "A fixture for the application’s TMDB response boundary.",
  poster_path: "/poster.jpg",
  backdrop_path: null,
  release_date: "2024-01-01",
  vote_average: 8,
  vote_count: 1234,
  popularity: 10,
  genre_ids: [16],
  original_language: "en",
};
const fixturePage = {
  results: [fixtureMovie],
  page: 1,
  total_pages: 1,
  total_results: 1,
};
const secret = "test-token-that-must-stay-server-side";

function expectedError(status: number) {
  return (error: unknown) =>
    error instanceof ApiError && error.status === status;
}

test("query parsing canonicalizes set filters and rejects unsupported or excessive inputs", () => {
  const first = parseMovieQuery(
    new URLSearchParams("genres=35,16,35&providers=9,8,9"),
  );
  const second = parseMovieQuery(
    new URLSearchParams("providers=8,9&genres=16,35"),
  );
  assert.deepEqual(first, second);
  assert.equal(
    buildDiscoverUrl(first.filters),
    buildDiscoverUrl(second.filters),
  );
  assert.deepEqual(parseMovieQuery(new URLSearchParams()), {
    filters: DEFAULT_FILTERS,
    page: 1,
  });
  for (const query of [
    "url=https://example.org",
    "api_key=visitor-key",
    "watch_region=GB",
    "page=0",
    "page=501",
    "page=1.5",
    "page=01",
    "page=1&page=2",
    "genres=-1",
    "genres=16,,35",
    "genres=2147483648",
    `providers=${Array.from({ length: 21 }, (_, index) => index + 1).join(",")}`,
    "genreMode=none",
    "language=english",
    "language=EN",
    "runtime=90",
    "rating=9",
    "sort=secret.desc",
    "year=1900",
    `language=${"a".repeat(2050)}`,
  ])
    assert.throws(
      () => parseMovieQuery(new URLSearchParams(query)),
      expectedError(400),
      query,
    );
  assert.equal(parseMovieId("123"), 123);
  for (const id of ["0", "-1", "1.2", "123?api_key=x", "2147483648"])
    assert.throws(() => parseMovieId(id), expectedError(400));
  assert.throws(
    () => requireNoQuery(new URLSearchParams("api_key=x")),
    expectedError(400),
  );
});

test("the upstream discovery URL preserves US provider, genre, and runtime semantics", () => {
  const parsed = parseMovieQuery(
    new URLSearchParams(
      "genres=35,16&genreMode=all&providers=9,8&language=en&runtime=short&year=2020&rating=7&page=2",
    ),
  );
  const url = new URL(buildDiscoverUrl(parsed.filters, parsed.page));
  const q = url.searchParams;
  assert.equal(url.origin, "https://api.themoviedb.org");
  assert.equal(url.pathname, "/3/discover/movie");
  for (const [key, value] of Object.entries({
    with_genres: "16,35",
    with_watch_providers: "8|9",
    watch_region: "US",
    with_watch_monetization_types: "flatrate|free|ads",
    with_original_language: "en",
    "with_runtime.gte": "1",
    "with_runtime.lte": "90",
    "vote_average.gte": "7",
    "primary_release_date.gte": "2020-01-01",
    page: "2",
    include_adult: "false",
  }))
    assert.equal(q.get(key), value, key);
  assert.equal(
    new URL(
      buildDiscoverUrl({ ...parsed.filters, genreMode: "any" }),
    ).searchParams.get("with_genres"),
    "16|35",
  );
  for (const [runtime, lower, upper] of [
    ["medium", "91", "120"],
    ["long", "121", "180"],
    ["epic", "181", null],
  ] as const) {
    const params = new URL(buildDiscoverUrl({ ...DEFAULT_FILTERS, runtime }))
      .searchParams;
    assert.equal(params.get("with_runtime.gte"), lower);
    assert.equal(params.get("with_runtime.lte"), upper);
  }
});

test("client URLs use canonical filter sets and the same landing URL for shared caching", async (t) => {
  const urls: string[] = [];
  t.mock.method(
    globalThis,
    "fetch",
    async (input: RequestInfo | URL, init?: RequestInit) => {
      urls.push(String(input));
      assert.equal(new Headers(init?.headers).has("authorization"), false);
      assert.equal(init?.credentials, "same-origin");
      return Response.json(fixturePage);
    },
  );
  await fetchClientMovies(DEFAULT_FILTERS);
  await fetchClientMovies({
    ...DEFAULT_FILTERS,
    genres: [35, 16, 35],
    providers: [9, 8],
  });
  await fetchClientMovies({
    ...DEFAULT_FILTERS,
    genres: [16, 35],
    providers: [8, 9],
  });
  assert.equal(urls[0], "/api/movies");
  assert.equal(urls[1], urls[2]);
  assert.ok(urls.every((url) => url.startsWith("/api/movies")));
});

test("server fetches carry credentials and the intended persistent cache policy", async (t) => {
  const calls: {
    url: URL;
    init: RequestInit;
  }[] = [];
  const timeoutCalls: number[] = [];
  t.mock.method(AbortSignal, "timeout", (milliseconds: number) => {
    timeoutCalls.push(milliseconds);
    return new AbortController().signal;
  });
  const fetcher: typeof fetch = async (input, init) => {
    const url = new URL(String(input));
    calls.push({ url, init: init! });
    if (url.pathname.endsWith("/genre/movie/list"))
      return Response.json({ genres: [{ id: 16, name: "Animation" }] });
    if (url.pathname.endsWith("/configuration/languages"))
      return Response.json([
        { iso_639_1: "en", english_name: "English", name: "English" },
      ]);
    if (url.pathname.endsWith("/watch/providers/movie"))
      return Response.json({
        results: [
          {
            provider_id: 8,
            provider_name: "Netflix",
            logo_path: null,
            display_priority: 0,
          },
        ],
      });
    if (url.pathname === "/3/movie/123")
      return Response.json({
        ...fixtureMovie,
        genres: [{ id: 16, name: "Animation" }],
        runtime: 85,
        private_field: secret,
      });
    return Response.json({ ...fixturePage, private_field: secret });
  };
  const service = createMovieService({ token: ` Bearer ${secret} `, fetcher });
  assert.equal((await service.catalog()).mode, "live");
  const landing = await service.movies(DEFAULT_FILTERS, 1);
  await service.movies({ ...DEFAULT_FILTERS, genres: [16] }, 1);
  const details = await service.details(123);
  assert.deepEqual(
    calls.map((call) => call.init.next?.revalidate),
    [86400, 86400, 86400, 900, 300, 21600],
  );
  assert.ok(timeoutCalls.every((timeout) => timeout === 10000));
  for (const call of calls) {
    assert.equal(call.url.origin, "https://api.themoviedb.org");
    assert.equal(
      new Headers(call.init.headers).get("authorization"),
      `Bearer ${secret}`,
    );
    assert.equal(call.url.searchParams.has("api_key"), false);
    assert.equal(call.init.cache, "force-cache");
    assert.equal(call.init.redirect, "error");
    assert.ok(call.init.signal instanceof AbortSignal);
  }
  const providers = calls.find((call) =>
    call.url.pathname.endsWith("/watch/providers/movie"),
  )!;
  assert.equal(providers.url.searchParams.get("watch_region"), "US");
  assert.equal(details.runtime, 85);
  assert.deepEqual(details.genre_ids, [16]);
  assert.equal(JSON.stringify([landing, details]).includes(secret), false);
});

test("legacy API keys stay on the upstream request and are removed from returned data", async () => {
  const key = "a".repeat(32);
  const fetcher: typeof fetch = async (input, init) => {
    assert.equal(new URL(String(input)).searchParams.get("api_key"), key);
    assert.equal(new Headers(init?.headers).has("authorization"), false);
    return Response.json({ ...fixturePage, api_key: key });
  };
  const result = await createMovieService({ token: key, fetcher }).movies(
    DEFAULT_FILTERS,
    1,
  );
  assert.equal(JSON.stringify(result).includes(key), false);
});

test("upstream failures, network details, and timeout errors are sanitized", async () => {
  for (const [status, expected] of [
    [401, 503],
    [403, 503],
    [404, 404],
    [429, 503],
    [500, 502],
  ] as const) {
    const service = createMovieService({
      token: secret,
      fetcher: async () =>
        Response.json({ status_message: secret }, { status }),
    });
    await assert.rejects(
      service.movies(DEFAULT_FILTERS, 1),
      (error: unknown) =>
        expectedError(expected)(error) && !String(error).includes(secret),
    );
  }
  for (const error of [
    new Error(`upstream failed: ${secret}`),
    new DOMException(secret, "TimeoutError"),
    new DOMException(secret, "AbortError"),
  ]) {
    const service = createMovieService({
      token: secret,
      fetcher: async () => {
        throw error;
      },
    });
    await assert.rejects(
      service.movies(DEFAULT_FILTERS, 1),
      (caught: unknown) =>
        expectedError(error.name === "Error" ? 502 : 504)(caught) &&
        !String(caught).includes(secret),
    );
  }
  const malformed = createMovieService({
    token: secret,
    fetcher: async () => Response.json({ results: secret }),
  });
  await assert.rejects(
    malformed.movies(DEFAULT_FILTERS, 1),
    expectedError(502),
  );
});

test("without a credential the server supplies labeled sample data without an upstream request", async () => {
  const service = createMovieService({
    fetcher: async () => {
      throw new Error("Demo mode must not call TMDB");
    },
  });
  assert.equal((await service.catalog()).mode, "demo");
  const movies = await service.movies(
    { ...DEFAULT_FILTERS, genres: [16], language: "ja" },
    1,
  );
  assert.ok(movies.results.length > 0);
  assert.ok(
    movies.results.every(
      (movie) =>
        movie.genre_ids.includes(16) && movie.original_language === "ja",
    ),
  );
  const selected = movies.results[0];
  assert.equal((await service.details(selected.id)).id, selected.id);
  await assert.rejects(service.details(2147483647), expectedError(404));
});

test("successful data is shared-cacheable while errors are always uncached", async () => {
  assert.equal(movieCacheSeconds(DEFAULT_FILTERS, 1), CACHE_SECONDS.landing);
  assert.equal(movieCacheSeconds(DEFAULT_FILTERS, 2), CACHE_SECONDS.filtered);
  assert.equal(
    movieCacheSeconds({ ...DEFAULT_FILTERS, providers: [8] }, 1),
    CACHE_SECONDS.filtered,
  );
  for (const seconds of Object.values(CACHE_SECONDS)) {
    const headers = sharedCacheHeaders(seconds);
    assert.equal(
      headers["Cache-Control"],
      `public, max-age=0, s-maxage=${seconds}, stale-while-revalidate=60`,
    );
    assert.equal(
      headers["CDN-Cache-Control"],
      `public, s-maxage=${seconds}, stale-while-revalidate=60`,
    );
    assert.equal(
      headers["Vercel-CDN-Cache-Control"],
      headers["CDN-Cache-Control"],
    );
  }
  const response = errorResponse(new Error(secret));
  assert.equal(response.status, 500);
  assert.equal((await response.text()).includes(secret), false);
  for (const key of [
    "Cache-Control",
    "CDN-Cache-Control",
    "Vercel-CDN-Cache-Control",
  ])
    assert.equal(response.headers.get(key), "no-store");
  assert.equal(errorResponse(new ApiError("Invalid query.", 400)).status, 400);
});
