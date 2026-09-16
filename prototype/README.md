# Movie Night

A responsive Next.js prototype for choosing a movie together. Browse by genre, original language, runtime, release decade, minimum rating, and US streaming service. Save a shortlist on the current device and open movie details before making a decision.

## Run locally

With Nix and flakes enabled:

```sh
cd ~/repos/cs422-project/prototype
nix develop
pnpm install --frozen-lockfile
pnpm dev
```

Or use Node.js 24 and pnpm 11.19 directly:

```sh
pnpm install --frozen-lockfile
pnpm dev
```

Open <http://localhost:3000>. The server binds to `0.0.0.0`, so a phone on the same network can open `http://YOUR_COMPUTER_LAN_IP:3000` if the firewall permits access. Production: `pnpm build && pnpm start`.

## Connect live TMDB data

1. Obtain an **API Read Access Token** from [your TMDB API settings](https://www.themoviedb.org/settings/api).
2. Click **Connect TMDB** in the app, paste it, and click **Connect**. A v3 API key is also accepted.
3. The app validates the credential, loads TMDB genres, languages, and US streaming providers, and queries the Discover API as filters change.

All TMDB API requests execute in the user's browser using `fetch`, including metadata, discovery, and movie details. Posters also load directly from TMDB's image CDN. There are no Next.js API routes, server actions, or server-side TMDB proxies. Credentials are stored in `sessionStorage` for the current tab session, visible to browser code, and sent only to TMDB. No credential is bundled in the app. Disconnect removes the saved credential and returns to demo mode.

Without a credential, the app uses an explicitly labeled local sample collection. Sample streaming assignments are illustrative, not current availability. Live integration requires your TMDB credential; automated tests intercept TMDB requests and do not claim to verify a real account or current catalog.

## Filter behavior

- **Genres:** matches any selected genre by default; “Must include every selected genre” switches to AND matching.
- **Language:** filters original movie language, while result descriptions use English.
- **Length:** 1–90, 91–120, 121–180, or 181+ minutes. Runtime is fetched from movie details in live mode because discovery responses do not contain it.
- **Decade/rating:** combines with the other filters. Live discovery excludes future releases, adult/video entries, and movies with fewer than 100 votes.
- **Streaming:** fixed to **USA**. Matches any selected service, including subscription, free, and ad-supported availability; excludes rental/purchase-only offers. No service selected means no availability restriction. Provider filtering uses `watch_region=US`, `with_watch_providers`, and `with_watch_monetization_types=flatrate|free|ads`.
- **Shortlist:** stored in `localStorage` on the current browser, independent of discovery filters. It is a shared-screen planning tool for now; multi-device rooms and group voting are future work.

Requests are debounced and canceled when filters change. The interface handles missing posters, loading, no matches, authentication failures, rate limiting, and network failures. Native dialogs provide focus containment and Escape dismissal, and the mobile filter sheet uses the same filtering logic as desktop.

## Validation

```sh
pnpm lint
pnpm typecheck
pnpm build
pnpm exec playwright install chromium
pnpm test:e2e
```

Keep a server running at `http://localhost:3000` for browser tests. For a production preview, stop the development server, run `pnpm build`, then `pnpm start` in a separate terminal. Avoid building while the development server is running. Tests cover desktop and mobile filtering, shortlist persistence, connection failures, and direct TMDB requests with mocked responses. On NixOS, use a system Chromium binary:

```sh
PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH="$(command -v chromium)" pnpm test:e2e
```

## Structure

- `src/app/page.tsx` — client-side interface, state, persistence, and requests.
- `src/app/globals.css` — responsive visual design and mobile filter sheet.
- `src/lib/tmdb.ts` — TMDB types, request builder, authentication, and errors.
- `src/lib/demo.ts` — local sample collection and matching logic.
- `tests/prototype.spec.ts` — browser interaction and request-contract tests.
- `flake.nix` / `flake.lock` — pinned Nix development environment.

## Data and attribution

This product uses the TMDB API but is not endorsed or certified by TMDB. Movie information and artwork belong to their respective owners. Streaming availability is provided by [JustWatch](https://www.justwatch.com/).

Reference: [TMDB Discover API](https://developer.themoviedb.org/reference/discover-movie), [authentication](https://developer.themoviedb.org/docs/authentication-application), [watch providers](https://developer.themoviedb.org/reference/watch-providers-movie-list), and [official logos](https://www.themoviedb.org/about/logos-attribution).
