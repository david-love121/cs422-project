# Veto

Veto helps two to six people choose a movie they are willing and able to watch on one shared device. Set practical limits, add suggestions with one click, respond privately, and choose a surviving movie together.

**Setup → Suggest → Vote → Choose.** Really Want, Okay, Prefer another, and Veto distinguish enthusiasm, willingness, a softer preference, and an objection. A recorded veto eliminates a movie regardless of other totals. The app explains the outcome; the group makes the final choice and opens the streaming service separately.

Accessibility needs are group requirements and never spend a viewer’s one preference veto. A newly discovered issue covers the private turn and offers shared review. Changing the agreed limits or set requires fresh ballots. Known runtime/end-time conflicts are explained inline.

## Run locally

The Next.js app is in `prototype/`. Use Node.js 24 and pnpm 11.19.0. The included Nix shell provides the development tools on supported systems.

```sh
cd prototype
# Optional on Nix: nix develop
pnpm install --frozen-lockfile
cp .env.example .env.local
pnpm dev
```

Open <http://localhost:3000>. For a production preview, stop the development server, run `pnpm build`, then `pnpm start`.

Leave `TMDB_API_TOKEN` blank for the prepared collection. To enable live data, set a TMDB application read-access token (or v3 API key) in `.env.local`. It remains on the server; visitors do not supply credentials. An invalid configured token produces an error rather than silently changing data sources.

## Settings

Click the Veto logo for a small settings menu. **Dark mode** switches the color scheme; **Live data** switches both suggestions and Explore between the prepared collection and the server-backed TMDB catalog. Both settings are remembered on the device. New sessions default to light mode and demo data. Existing rounds and saved ideas stay available when the source changes.

## How it works

- Every viewer gets a nomination opportunity or an explicit skip. Click a title to add it immediately, up to six distinct options; there is no per-movie verification screen.
- Each private turn separates selected, saved, reviewed, and submitted responses. Correcting a saved veto restores its allowance; a second objection can pause the round.
- Handoff and restored voting sessions cover responses before another viewer begins. Aggregate results may still allow inference; the app does not promise anonymity.
- Fresh rounds retain the agreement and actual recorded objections. Reconsidering rejected titles requires explicit agreement and fresh nominations/ballots.
- Final confirmation rechecks the current time and practical fit. There are no remote rooms, accounts, learned rankings, or automatic playback.

The prepared collection contains 31 real films, with TMDB metadata and US streaming listings retrieved on **November 9, 2026**. To keep this classroom prototype smooth, suggestions assume the agreed streaming access, audio, subtitles, and no extra charge. Recorded provider/language matches are preferred; missing information uses the group’s first agreed option and a 120-minute runtime fallback. These are prototype assumptions, not live playback verification. Explore can extend the collection; saved ideas are available for nominations.

Round state stays in the browser tab’s session storage; the browsing shortlist stays in local storage. Failed storage writes are explained, and invalid stored data is handled safely. Ballots and saved ideas are not sent to the catalog endpoints or mixed into shared caches.

## Server API

All endpoints use same-origin `GET` requests and return JSON. An optional `mode=demo` or `mode=live` selects the source explicitly; requests without it retain automatic server configuration. Movie IDs and filters are validated on the server.

| Endpoint | Response | Shared-cache interval |
| --- | --- | --- |
| `/api/catalog` | Live/sample mode, genres, languages, providers | 24 hours |
| `/api/movies` | Movie page; genre, original-language, runtime, decade, rating, service and sort filters | 15 minutes for the landing list; 5 minutes for filtered lists/later pages |
| `/api/movies/<id>` | One movie with detail/runtime information | 6 hours |

Errors are uncached and sanitized. These cache intervals are not guarantees of maximum data age: upstream and CDN caches refresh independently. Artwork loads from TMDB’s image CDN. See [`src/lib/server/`](./prototype/src/lib/server/) and the [route handlers](./prototype/src/app/api/) for the implementation.

## Validate

```sh
cd prototype
pnpm lint
pnpm typecheck
pnpm test:unit
pnpm exec playwright install chromium
pnpm test:e2e
```

The browser suite builds and starts its own production sample server at `http://127.0.0.1:3001`, using no TMDB secret. Stop any development server first because the build shares `.next/`. Set `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` to use a compatible system Chromium binary. `BASE_URL` selects an existing external app; API checks explicitly select demo mode for repeatable results.

The tests cover real API handlers, filtering/details, shortlist persistence, eligibility and response totals, three-/six-viewer turns, keyboard focus, concealed handoff, correction, access review, recovery, and deadline expiry. CI runs the same secret-free checks. Tests do not establish current streaming-account access or replace a participant study.

## Hosting and project scope

Hosted prototype: <https://cs422-veto.vercel.app>. Deploy `prototype/` as a Next.js app on Node.js 24 and configure `TMDB_API_TOKEN` on the server when live discovery is needed. This is Team 9’s CS422 functional prototype; the [course assignment](https://ecologylab.net/courses/ui/deliverables/functional.html) provides its deliverable context.

`main` is the single maintained version, combining Veto’s decision workflow with the server-backed catalog. Earlier branch histories remain in Git. Research notes, audits, agent guidance, presentation planning, and other working documentation are kept locally rather than published in this repository.

This product uses the TMDB API but is not endorsed or certified by TMDB. Movie metadata and artwork belong to their respective owners; streaming listings are provided by [JustWatch](https://www.justwatch.com/).
