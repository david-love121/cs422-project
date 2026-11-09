# Veto — CS422 functional prototype

Veto helps two to six people choose a movie they are willing and able to watch, using one shared device. The four stages are **Setup → Suggest → Vote → Choose**. The **Decide together** workspace provides that flow; **Explore** and **Shortlist** retain the movie discovery tools.

The visual direction is minimal: a neutral canvas, clear typography, restrained color, and visible action/state feedback. Movie artwork supports comparison; it does not determine a winner. Vetoes are firm objections, and enthusiastic votes cannot cancel them.

## Run locally

Use Node.js 24 and pnpm 11.19, or the included Nix development shell:

```sh
cd prototype
nix develop
pnpm install --frozen-lockfile
cp .env.example .env.local
# Optional: set TMDB_API_TOKEN in .env.local for live movies.
pnpm dev
```

The token stays on the Next.js server. Leave it blank for the labeled sample catalog; visitors do not need a TMDB account or token. An invalid configured token produces an error rather than silently changing to sample data.

Without Nix, omit `nix develop`. Open <http://localhost:3000>. The server binds to `0.0.0.0`; another device on the same network can use the host computer’s LAN address.

For a production build:

```sh
pnpm build
pnpm start
```

## Walkthrough and design evidence

See the [functional prototype guide](./docs/functional-prototype.md) for the task walkthrough, R1–R13 traceability, information model, and evaluation notes. It also identifies prototype limitations for the next user study.

The design follows the team’s low-fidelity study findings: make nominations explicit, distinguish selected/saved/submitted responses, cover private turns before handoff, and populate the final decision summary. Private study materials and participant records are not included in this public repository.

The [CS422 functional prototype assignment](https://ecologylab.net/courses/ui/deliverables/functional.html) calls for a hosted working app, revised specifications, information design, and an honest account of the supported experience. The code and guide cover the app; presentation and course submission are separate deliverables.

## Data and privacy boundaries

This is a shared-device prototype. It does not create networked rooms, synchronize ballots across phones, or start playback. A confirmed decision records the group’s choice; the group opens its streaming service separately.

Private turns hide responses from the next viewer during ordinary use. Aggregate results may reveal preferences in a small group; the app does not promise anonymity. Browser storage and developer tools are outside that visual handoff protection.

Real movie metadata and artwork are supported by the existing TMDB integration and a prepared catalog. Streaming subscriptions, language tracks, subtitle access, and extra charges need explicit checks in the actual service before a candidate can join a round. Prepared examples are not evidence of current availability.

The [catalog API guide](./docs/tmdb-api.md) documents the same-origin endpoints, request objects, filters, server credential boundary, errors, and cache lifetimes. `main` contains both this server implementation and the Veto interface; a separate server checkout is no longer required. The [consolidation audit](./docs/consolidation.md) records the earlier differences.

## Validation commands

```sh
pnpm lint
pnpm typecheck
pnpm test:server
pnpm build
pnpm test:e2e
```

Browser tests require the app to be running at `http://localhost:3000` (or `BASE_URL`) and a compatible Chromium installation. Install it with `pnpm exec playwright install chromium`, or set `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` to a system Chromium binary. Stop `pnpm dev` before building or running the production server. Test fixtures exercise deterministic flows; they do not verify a real streaming account or current catalog availability. See the functional prototype guide for the checks performed on this revision.

## Hosting

Deploy the `prototype/` directory as a Next.js app using Node.js 24 and the pinned pnpm version. Configure `TMDB_API_TOKEN` in the host’s server environment for live discovery; never use a `NEXT_PUBLIC_` variable for this credential. This consolidation does not create a second app or change hosting access settings.

The existing Veto deployment is <https://cs422-veto.vercel.app>. The former server worktree was linked to a separate `cs422-movie-night` Vercel project; that link is historical configuration, not an additional maintained source version. Hosting projects are not deleted by the repository cleanup.
