# Veto — CS422 functional prototype

Veto helps two to six people choose a movie they are willing and able to watch, using one shared device. The four stages are **Setup → Suggest → Vote → Choose**. The **Decide together** workspace provides that flow; **Explore** and **Shortlist** retain the movie discovery tools.

The visual direction is minimal: a neutral canvas, clear typography, restrained color, and visible action/state feedback. Movie artwork supports comparison; it does not determine a winner. Vetoes are firm objections, and enthusiastic votes cannot cancel them.

## Run locally

Use Node.js 24 and pnpm 11.19, or the included Nix development shell:

```sh
cd prototype
nix develop
pnpm install --frozen-lockfile
pnpm dev
```

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

The [client API guide](./docs/tmdb-client-api.md) documents the catalog integration’s request objects, filters, authentication, and error handling. The [server-side branch](https://github.com/david-love121/cs422-project/tree/server-side/prototype) documents its separate server credential and cache architecture.

## Validation commands

```sh
pnpm lint
pnpm typecheck
pnpm build
pnpm test:e2e
```

Browser tests require the app to be running and a compatible Chromium installation. Test fixtures exercise deterministic flows; they do not verify a real streaming account or current catalog availability. See the functional prototype guide for the checks performed on this revision.
