# CS422 Project — server-side branch

Movie Night is a responsive movie discovery prototype. This `server-side` branch keeps TMDB credentials on the Next.js server and shares cached movie results between visitors. The Next.js application lives in [`prototype/`](./prototype/).

Read the [prototype README](./prototype/README.md) for setup and the implementation guide:

- [Request flow and credential handling](./prototype/README.md#how-requests-move-through-the-app)
- [API endpoints, JSON objects, filters, and errors](./prototype/README.md#api-endpoints-and-response-objects)
- [Cache layers, lifetimes, keys, and refresh behavior](./prototype/README.md#shared-caching)
- [Deployment and validation](./prototype/README.md#deployment-on-vercel)

The [client-side version on `main`](https://github.com/david-love121/cs422-project/tree/main) calls TMDB directly from the browser; its README explains the upstream API in detail.
