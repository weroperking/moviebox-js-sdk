t done# Moviebox JavaScript SDK

Unofficial TypeScript/ESM SDK for interacting with the Moviebox API. It provides resilient session management (mirrors, retries, cookies), typed data models, streaming metadata helpers, and download utilities.

## Installation

```bash
npm install moviebox-js-sdk
# or
pnpm add moviebox-js-sdk
# or
yarn add moviebox-js-sdk
```

Node.js 18+ is required. The package is published as pure ESM.

## Quickstart

```ts
import {
  MovieboxSession,
  search,
  getMovieDetails,
  getMovieStreamUrl
} from 'moviebox-js-sdk';

const session = new MovieboxSession();

const results = await search(session, { query: 'Inception' });
const first = results.results[0];

if (first) {
  const details = await getMovieDetails(session, { detailPath: first.detailPath });
  const stream = await getMovieStreamUrl(session, { detailPath: first.detailPath, quality: 'best' });

  console.log(details.title, stream.stream?.url);
}
```

## Session Configuration

```ts
import { MovieboxSession, createLogger } from 'moviebox-js-sdk';

const session = new MovieboxSession({
  host: 'h5.aoneroom.com',
  mirrorHosts: ['h5.aoneroom.com', 'movieboxapp.in'],
  proxyUrl: process.env.MOVIEBOX_API_PROXY,
  logger: createLogger({ level: 'info' }),
  retry: {
    maxAttempts: 2,
    delayMs: 250
  }
});
```

Environment variables:

- `MOVIEBOX_API_HOST` – override the default mirror host.
- `MOVIEBOX_API_PROXY` – route requests through an HTTP/S/SOCKS proxy (see `docs/proxy.md`).

## Features

| Capability          | Module / Example                        |
|---------------------|-----------------------------------------|
| Search              | `search(session, params)`               |
| Movie / Series data | `getMovieDetails`, `getSeriesDetails`   |
| Streaming metadata  | `getMovieStreamUrl`, `getEpisodeStreamUrl` |
| Downloads           | `downloadMovie`, `downloadEpisode`      |
| CLI sample          | `src/cli/download.ts`                   |
| Express sample      | `examples/express/`                     |
| Next.js API sample  | `examples/nextjs/`                      |
| Vue composable      | `examples/vue/`                         |

## Downloads & Progress

```ts
import { downloadMovie } from 'moviebox-js-sdk';

const filePath = await downloadMovie(session, {
  detailPath: 'titanic-m7a9yt0abq6',
  quality: 1080,
  outputDir: './downloads',
  onProgress: ({ downloadedBytes, totalBytes, percentage }) => {
    console.log(`Downloaded ${downloadedBytes}/${totalBytes ?? 0} (${percentage ?? 0}%)`);
  }
});
```

## Examples

- **Express** – REST routes for search/stream/download (`examples/express/`).
- **Next.js API route** – serverless endpoint wrapper (`examples/nextjs/`).
- **Vue composable** – composition API helper for search/detail flows (`examples/vue/`).

## Documentation & Guides

- `docs/proxy.md` – configuring proxies and VPNs.
- `docs/api-reference.md` – summary of exported helpers and types.

## npm Scripts

```bash
npm run build      # Compile TypeScript
npm run test       # Execute Vitest suite
npm run lint       # ESLint checks
npm run format     # Run Prettier
```

## Contributing

1. `npm install`
2. `npm run lint && npm run test`
3. Submit PRs with accompanying tests/fixtures.

## License

ISC
# moviebox-js-sdk
