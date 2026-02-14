# API Reference

This document provides a high-level overview and detailed usage examples for the main exports of `moviebox-js-sdk`.

---

## Session

### Creating a Session

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

**Options:**
- `host?`: string
- `mirrorHosts?`: readonly string[]
- `proxyUrl?`: string
- `retry?`: { maxAttempts?: number; delayMs?: number; shouldRetryError?: (error, ctx) => boolean; shouldRetryResponse?: (response, ctx) => boolean }
- `logger?`: Logger

**Methods:**
- `fetchJson(path, options)`
- `fetchHtml(path, options)`
- `ensureSessionCookies()`
- `buildDetailUrl(detailPath, subjectId)`

---

## Search

### Searching Movies & Series

```ts
import { search } from 'moviebox-js-sdk';
const results = await search(session, { query: 'Merlin', type: 'movie', page: 1 });
```

- `params.query`: required string
- Optional filters: `type`, `page`, `perPage`
- Returns: `SearchResultPage`

---

## Movie APIs

- `getMovieDetails(session, { detailPath, subjectId? })`
- `getMovieStreamUrl(session, { detailPath, subjectId?, quality? })`
- `downloadMovie(session, { detailPath, quality?, outputDir?, filename?, mode?, parallel?, chunkSize?, onProgress? })`

**Example:**
```ts
import { getMovieDetails } from 'moviebox-js-sdk';
const details = await getMovieDetails(session, { detailPath: 'titanic-m7a9yt0abq6' });
```

---

## Series APIs

- `getSeriesDetails(session, { detailPath })`
- `getEpisodeQualities(session, { detailPath, subjectId?, season, episode })`
- `getEpisodeStreamUrl(session, { detailPath, subjectId?, season, episode, quality? })`
- `downloadEpisode(session, { detailPath, season, episode, quality?, ... })`

---

## Shared Types

- `MovieDetails`, `SeriesDetails`
- `StreamOption`, `StreamResult`
- `DownloadQuality` ('best' | 'worst' | number)
- `DownloadMode` ('auto' | 'resume' | 'overwrite')
- `DownloadProgress` ({ downloadedBytes, totalBytes, percentage })
- Error classes: `MovieboxApiError`, `MovieboxHttpError`, `EmptyResponseError`, `UnsuccessfulResponseError`, `GeoBlockedError`, `MirrorExhaustedError`, `RetryLimitExceededError`

---

## Logging

- `createLogger(options)` – wraps pino
- `createNoopLogger()` – silent logger for tests

---

## CLI Helpers

- `src/cli/download.ts` – invokes download APIs via command line
- Usage: `tsx src/cli/download.ts movie --detail <path>`

---

Refer to inline TypeScript definitions for full shape details. See [examples/](../examples/) for practical usage in Express, Next.js, and Vue.
