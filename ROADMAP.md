# Moviebox JavaScript SDK — Development Roadmap

## Phase 0 — Project Setup
- [ ] Initialize TypeScript Node project (ESM)
- [ ] Configure linting, formatting, testing (ESLint, Prettier, Vitest/Jest)
- [ ] Set up basic CI/check workflows (optional)
- [ ] Capture sample API responses for fixtures

## Phase 1 — Core Session Layer
- [x] Implement `MovieboxSession` with mirror + proxy support
- [x] Handle default headers, cookies, mirror fallback, retries
- [x] Provide low-level `fetchJson`, `fetchHtml` helpers

## Phase 2 — Search API
- [ ] Build `search({ query, type, page, perPage })`
- [ ] Normalize results to TS interfaces (id, title, year, pageUrl, rating, etc.)
- [ ] Unit tests with fixtures

## Phase 3 — Movie Details & Qualities
- [ ] Parse movie detail page JSON
- [ ] Extract metadata (title, synopsis, genres, poster)
- [ ] Resolve downloadable files, map qualities + sizes
- [ ] Capture available subtitles

## Phase 4 — TV Series Support
- [x] Implement `seriesDetails(pageUrl)` (seasons, episodes)
- [x] Implement `episodeQualities(pageUrl, season, episode)`
- [x] Tests for season/episode extraction

## Phase 5 — Stream URL Helpers
- [x] `getMovieStreamUrl(pageUrl, quality)`
- [x] `getEpisodeStreamUrl(pageUrl, season, episode, quality)`
- [x] Return stream URL + subtitles + size metadata

## Phase 6 — Download (Optional)
- [x] Node downloader (parallel chunks, resume)
- [x] CLI commands (download movie/episode)
- [x] Progress callback support

## Phase 7 — Error Handling & Resilience
- [ ] Custom error classes (GeoBlockedError, MirrorError, etc.)
- [ ] Configurable retry/mirror strategy
- [ ] Detailed logging (pino/debug)

## Phase 8 — Proxy & VPN Integration
- [x] Environment-based proxy config (`MOVIEBOX_API_PROXY`)
- [x] Document VPN/proxy usage for consumers

## Phase 9 — Documentation & Samples
- [x] Comprehensive README (install, quickstart, config)
- [x] Examples: Node download script, Next.js API route, Vue integration
- [x] TypeDoc or API reference generation

## Phase 10 — Publish & Integration
- [x] Prepare npm package metadata (ESM/CJS exports)
- [x] Automated build/test pipeline
- [ ] Publish v0.1.0 to npm
- [x] Integrate into Makaveli Nuxt app (replace Python service)
