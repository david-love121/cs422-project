# CS422 Project

Movie Night is a responsive movie discovery prototype. This `main` branch runs TMDB requests directly in the user's browser. The Next.js application lives in [`prototype/`](./prototype/).

Start with the [prototype README](./prototype/README.md) for setup and a walkthrough of the API:

- [Request lifecycle and authentication](./prototype/README.md#how-a-live-request-works)
- [Endpoints, response envelopes, and API objects](./prototype/README.md#endpoints-and-response-objects)
- [How filters become a Discover request](./prototype/README.md#how-filters-become-a-discover-request)
- [Storage, caching, and error handling](./prototype/README.md#storage-caching-and-errors)

The [`server-side` branch](https://github.com/david-love121/cs422-project/tree/server-side) contains the version that keeps the TMDB credential on the server and caches shared responses; its README explains that architecture separately.
