# Veto

A shared-device movie decision tool for two to six viewers. Agree on practical limits, give everyone a suggestion, respond privately, and choose a film with no recorded vetoes.

Veto is Team 9’s CS422 functional prototype. Its design follows the group’s low-fidelity study: willingness is different from enthusiasm, a firm objection counts, and the group should understand what is saved, submitted, and carried into another round.

The Next.js app lives in [`prototype/`](./prototype/).

- [Run the app and understand its limits](./prototype/README.md)
- [Functional prototype specification, information model, and walkthrough](./prototype/docs/functional-prototype.md)
- [Movie catalog API and request flow](./prototype/docs/tmdb-api.md)

`main` is the single maintained version: Veto’s shared-device workflow plus server-backed movie discovery, server-only TMDB credentials, and shared caching. Both earlier branch histories are preserved in its merge commit.

See the [consolidation audit](./prototype/docs/consolidation.md) for the previous worktrees, branch differences, and validation.
