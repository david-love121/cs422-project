# Movie Night — server-side prototype

A responsive Next.js movie discovery app for choosing a movie together. Filter by genre, original language, runtime, decade, rating, and US streaming service; save a shortlist on the current device.

This version lives on the `server-side` branch in the `cs422-project-server` worktree. The original `cs422-project` checkout retains the browser-only version on `main`.

## Run locally

```sh
cd ~/repos/cs422-project-server/prototype
nix develop
pnpm install --frozen-lockfile
cp .env.example .env.local
# Set TMDB_API_TOKEN in .env.local with your TMDB application read access token.
pnpm dev --port 3001
```

Node.js 24 and pnpm 11.19 can also be used without Nix. Open <http://localhost:3001>. The server binds to `0.0.0.0`, so another device on your network can use the computer's LAN address if the firewall permits it.

Stop the development server before running `pnpm build`, then use `pnpm start --port 3001` for a production preview.

## Credentials and request flow

Set `TMDB_API_TOKEN` to your [TMDB application API Read Access Token](https://www.themoviedb.org/settings/api). A v3 API key is also accepted. The variable is server-only: never prefix it with `NEXT_PUBLIC_`. `.env.local` and Vercel project metadata are ignored by Git; environment files are also excluded from deployment uploads.

The browser calls only these same-origin JSON endpoints:

- `GET /api/catalog` — genres, languages, US providers, and `live` or `demo` status.
- `GET /api/movies` — a page of discovered movies using validated filter parameters.
- `GET /api/movies/[id]` — details for one movie.

The Next.js server authenticates with TMDB. No credential is included in browser JavaScript, browser storage, API responses, or client request headers. Posters still load directly from TMDB's image CDN. There is no credential form.

An absent token activates the explicitly labeled sample catalog. Sample provider assignments are illustrative, not current availability. An invalid configured token produces a recoverable error rather than silently returning sample results.

## Shared caching

| Request | Cache lifetime |
| --- | --- |
| Default landing movie list | 15 minutes |
| Filtered lists and subsequent pages | 5 minutes |
| Genres, languages, provider directory | 24 hours |
| Movie details | 6 hours |

TMDB fetches use Next.js's persistent data cache. Successful public catalog responses also carry CDN cache headers, with a 60-second stale-while-revalidate window. CDN hits can bypass the function; data-cache hits avoid another TMDB call. Cached content can be older than the freshness interval while a background refresh completes. These are request-driven refreshes, not scheduled jobs.

Filter IDs are sorted and deduplicated to share cache entries across equivalent requests. Browser URLs omit default values. USA is fixed; language, filters, sort order, page, and release-date bounds determine each movie query. Failed responses are not CDN-cached. Network requests have a 10-second timeout.

Only shared catalog data is cached. Each visitor's shortlist stays in localStorage and is never part of a shared server response.

## Deployment on Vercel

Deploy the `prototype` directory with the Next.js framework and Node.js 24. Set these variables in the desired deployment environments:

- `TMDB_API_TOKEN` — a **Secret**, with your application credential.
- `ENABLE_EXPERIMENTAL_COREPACK=1` — uses the pinned pnpm version.

With the CLI signed in:

```sh
pnpm dlx vercel@59.18.0 link --project cs422-movie-night
pnpm dlx vercel@59.18.0 deploy --prod
```

The Vercel project is configured for the free Hobby plan and all-deployment Vercel Authentication for private testing. Share a deployment's Vercel Shareable Link with trusted testers if they do not have project access. This protection applies before the cached page/API is served. The app itself does not implement accounts or a distributed rate limiter; disabling deployment protection makes its read-only endpoints public. Cache, bounded parameters, and timeouts limit routine work, but do not provide an abuse quota.

## Filter behavior

Genres match **any** selection by default; the checkbox enables **all** matching. Original language filters the movie's original language, while descriptions use English. Runtime ranges are 1–90, 91–120, 121–180, or 181+ minutes. Live discovery excludes future releases, adult/video entries, and movies with fewer than 100 votes.

Streaming matches any selected provider in **USA**, with subscription, free, and ad-supported offers; rental/purchase-only offers are excluded. No selected service means no streaming-availability restriction. Discover results do not include runtime; details load it on demand. Multi-device rooms and group voting are not part of this prototype.

## Validation

```sh
pnpm lint
pnpm typecheck
pnpm test:server
pnpm build
# In another terminal: pnpm start --port 3001
pnpm exec playwright install chromium
pnpm test:e2e
```

Browser tests use a running server at `http://localhost:3001`, or `BASE_URL`. They intercept the app's JSON API to verify desktop/mobile interaction, same-origin requests, errors, and shortlist persistence. Server tests inject a TMDB fetcher to verify query validation, canonical URLs, credential handling, cache options, demo behavior, and sanitized errors. Tests do not require real credentials.

On NixOS, select a system Chromium binary:

```sh
PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH="$(command -v chromium)" pnpm test:e2e
```

## Attribution

This product uses the TMDB API but is not endorsed or certified by TMDB. Movie information and artwork belong to their respective owners. Streaming availability is provided by [JustWatch](https://www.justwatch.com/).

References: [TMDB Discover](https://developer.themoviedb.org/reference/discover-movie), [TMDB authentication](https://developer.themoviedb.org/docs/authentication-application), [Next.js fetch caching](https://nextjs.org/docs/app/api-reference/functions/fetch), [Vercel cache headers](https://vercel.com/docs/caching/cache-control-headers).
