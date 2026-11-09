# Repository consolidation audit

Audited on November 9, 2026. The GitHub branch view was inspected in Firefox through the native Linux desktop tools, and the local refs were refreshed from `origin` before merging.

## What the names meant

There was one GitHub repository: `david-love121/cs422-project`. The two local directories were linked Git worktrees sharing the same object database, branch refs, and remote; they were not separate frontend/backend repositories or services.

| Location before consolidation | Branch and commit | Unique work |
| --- | --- | --- |
| `~/repos/cs422-project` | `main` at `fc34d84` | Veto branding, Setup → Suggest → Vote → Choose, private-turn ballots, veto rules, confirmation checks, functional specification, and voting tests. Discovery called TMDB directly using a visitor-supplied token. |
| `~/repos/cs422-project-server` | `server-side` at `ef5259e` | Earlier Movie Night interface with server-only TMDB credentials, three same-origin API endpoints, input/response validation, shared caching, sample fallback, server tests, and hosting configuration. It lacked Veto’s group decision workflow. |

The branches diverged from `b57f853` (`Create client-side Movie Night prototype`). `main` had two unique commits; `server-side` had three. GitHub displayed `server-side` as three commits ahead and two behind `main`. The root README’s branch reference was describing this parallel implementation, not a separately required server process.

## One maintained version

`main` combines both histories with a merge commit. The canonical working directory is `~/repos/cs422-project`; the app remains in `prototype/`. The superseded server worktree and branch are redundant after this merge; use only `main` in the canonical directory. Both original tips remain ancestors of the merge and can be recovered from Git history.

The consolidated application keeps:

- Veto’s current interface, accessibility, shared-device workflow, hard-veto rules, round restoration, and final eligibility checks.
- `/api/catalog`, `/api/movies`, and `/api/movies/<id>` from the server implementation, including bounded inputs, normalized output, sanitized errors, and server-only credentials.
- Shared cache lifetimes: 15 minutes for the default landing list, 5 minutes for filtered lists/later pages, 24 hours for metadata, and 6 hours for details. See the [API guide](./tmdb-api.md) for the two independent cache layers and their limits.
- Explicit sample mode when no server token is configured; failures with a configured token remain visible errors with retry.
- Existing shortlist and round storage keys. The obsolete browser token is removed on startup. Votes and shortlists remain on the device and never enter shared API caches.
- Both server contract tests and desktop/mobile Veto workflow tests. Discovery tests now exercise same-origin API requests and reject browser TMDB/API-key traffic.

The token form and browser-to-TMDB API implementation were removed. Artwork still loads from TMDB’s image CDN. Saved server results can enter Veto nominations; the group still confirms runtime, service access, audio, subtitles, and any charge. This consolidation does not add synchronized multi-device rooms or playback.

The former browser API guide URL now points to the unified [catalog API guide](./tmdb-api.md), and the functional specification describes the current credential boundary.

## Local configuration and hosting

Before cleanup, the main worktree was linked to the `cs422-veto` Vercel project and the server worktree to `cs422-movie-night`. These were deployment links, not additional repositories. The canonical checkout retains its Veto link. Credentials and `.vercel` metadata must remain outside Git; preserve the former worktree’s local configuration before removing it. No hosting project is deleted as part of source consolidation.

## Validation

- `pnpm lint`, `pnpm typecheck`, and `pnpm build`: passed on the merged application.
- `pnpm test:server`: all 8 contract tests passed.
- `pnpm test:e2e`: all 32 desktop/mobile checks passed (24 browser scenarios and 8 decision-engine checks across two projects), using the installed Chromium via `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH`.
- Production-mode sample API: catalog, landing/filtered movie lists, and details returned HTTP 200 with the expected shared cache lifetimes. Invalid runtime and visitor API-key parameters returned HTTP 400 with `no-store`.
- Native Firefox inspection: Veto setup and the server-backed sample Explore view rendered correctly.
- Production-mode live API and browser: the migrated server token successfully loaded metadata, landing movies, US provider/runtime-filtered results, and detail runtimes from real TMDB. Browser requests stayed on the application origin with no API key or authorization header, and no JavaScript errors occurred. Built browser assets did not contain the server credential.
- Local documentation links and whitespace checks: passed.

A complete pre-merge Git bundle and both worktrees’ private environment/hosting configuration were preserved outside the repository under `~/.local/state/cs422-consolidation/2026-11-09/`. The existing TMDB server credential was migrated to the canonical ignored `.env.local`; the former deployment’s OIDC token was not copied into the active app.
