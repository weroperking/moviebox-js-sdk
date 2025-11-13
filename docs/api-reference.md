# API Reference

High-level overview of the primary exports from moviebox-js-sdk.

## Session

### 
ew MovieboxSession(options)

Options:
- host?: string
- mirrorHosts?: readonly string[]
- proxyUrl?: string
- etry?: { maxAttempts?: number; delayMs?: number; shouldRetryError?: (error, ctx) => boolean; shouldRetryResponse?: (response, ctx) => boolean }
- logger?: Logger

Methods:
- etchJson(path, options)
- etchHtml(path, options)
- ensureSessionCookies()
- uildDetailUrl(detailPath, subjectId)

## Search

### search(session, params)
- params.query – required string
- Optional filters: 	ype, page, perPage
- Returns SearchResultPage

## Movie APIs

- getMovieDetails(session, { detailPath, subjectId? })
- getMovieStreamUrl(session, { detailPath, subjectId?, quality? })
- downloadMovie(session, { detailPath, quality?, outputDir?, filename?, mode?, parallel?, chunkSize?, onProgress? })

## Series APIs

- getSeriesDetails(session, { detailPath })
- getEpisodeQualities(session, { detailPath, subjectId?, season, episode })
- getEpisodeStreamUrl(session, { detailPath, subjectId?, season, episode, quality? })
- downloadEpisode(session, { detailPath, season, episode, quality?, ... })

## Shared Types

- MovieDetails, SeriesDetails
- StreamOption, StreamResult
- DownloadQuality ('best' | 'worst' | number)
- DownloadMode ('auto' | 'resume' | 'overwrite')
- DownloadProgress ({ downloadedBytes, totalBytes, percentage })
- Error classes: MovieboxApiError, MovieboxHttpError, EmptyResponseError, UnsuccessfulResponseError, GeoBlockedError, MirrorExhaustedError, RetryLimitExceededError

## Logging

- createLogger(options) – wraps pino
- createNoopLogger() – silent logger for tests

## CLI Helpers

- src/cli/download.ts – invokes download APIs via command line
- Usage: 	sx src/cli/download.ts movie --detail <path>

Refer to inline TypeScript definitions for full shape details.
