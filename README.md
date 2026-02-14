::: {align="center"}
# 🎬 Moviebox JavaScript SDK

**Unofficial TypeScript/ESM SDK for the Moviebox API**

[![npm
version](https://img.shields.io/npm/v/moviebox-js-sdk)](https://www.npmjs.com/package/moviebox-js-sdk)
[![License:
ISC](https://img.shields.io/badge/License-ISC-blue.svg)](https://opensource.org/licenses/ISC)
[![Node.js](https://img.shields.io/badge/Node.js-18%2B-green)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue)](https://www.typescriptlang.org)

Resilient session management • Typed data models • Streaming metadata •
Download utilities
:::

------------------------------------------------------------------------

## ✨ Features

-   🔍 **Search** --- Find movies, series, and music content
-   🎥 **Details** --- Get full metadata for movies and series
-   📡 **Streaming** --- Extract stream URLs with quality selection
-   ⬇️ **Downloads** --- Parallel chunked downloads with progress
    tracking
-   🔄 **Session Management** --- Auto mirror fallback, retries, and
    cookie handling
-   🌐 **Proxy Support** --- HTTP/HTTPS/SOCKS proxy routing
-   📦 **Pure ESM** --- Modern JavaScript module format
-   🛡️ **Fully Typed** --- Complete TypeScript type definitions

## 📦 Installation

``` bash
npm install moviebox-js-sdk
pnpm add moviebox-js-sdk
yarn add moviebox-js-sdk
```

**Requirements:** Node.js 18+ • Published as pure ESM

## 🚀 Quickstart

``` ts
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
  const details = await getMovieDetails(session, {
    detailPath: first.raw.detailPath
  });

  const stream = await getMovieStreamUrl(session, {
    detailPath: first.raw.detailPath,
    quality: 'best'
  });

  console.log(details.title, stream.stream?.url);
}
```

## ⚙️ Session Configuration

``` ts
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

### Environment Variables

  Variable             Description
  -------------------- ----------------------------------------------
  MOVIEBOX_API_HOST    Override the default mirror host
  MOVIEBOX_API_PROXY   Route requests through an HTTP/S/SOCKS proxy

## 📚 API Overview

  ----------------------------------------------------------------------------------
  Capability               Function                       Description
  ------------------------ ------------------------------ --------------------------
  🔍 Search                search(session, params)        Search movies, series,
                                                          music

  🎬 Movie Details         getMovieDetails(session,       Get full movie metadata
                           params)                        

  📺 Series Details        getSeriesDetails(session,      Get series metadata &
                           params)                        seasons

  📡 Movie Stream          getMovieStreamUrl(session,     Extract movie stream URL
                           params)                        

  📡 Episode Stream        getEpisodeStreamUrl(session,   Extract episode stream URL
                           params)                        

  ⬇️ Movie Download        downloadMovie(session, params) Download a movie file

  ⬇️ Episode Download      downloadEpisode(session,       Download an episode file
                           params)                        
  ----------------------------------------------------------------------------------

## ⬇️ Downloads & Progress

``` ts
import { MovieboxSession, downloadMovie } from 'moviebox-js-sdk';

const session = new MovieboxSession();

const filePath = await downloadMovie(session, {
  detailPath: 'inception-e1BOR6f19C7',
  quality: 1080,
  outputDir: './downloads',
  onProgress: ({ downloadedBytes, totalBytes, percentage }) => {
    const mb = (downloadedBytes / 1024 / 1024).toFixed(1);
    const total = ((totalBytes ?? 0) / 1024 / 1024).toFixed(1);
    console.log(`${mb}MB / ${total}MB (${percentage ?? 0}%)`);
  }
});

console.log('Saved to:', filePath);
```

## 📺 Series & Episodes

``` ts
import {
  MovieboxSession,
  search,
  getSeriesDetails,
  getEpisodeStreamUrl,
  downloadEpisode
} from 'moviebox-js-sdk';

const session = new MovieboxSession();

const results = await search(session, { query: 'Breaking Bad' });
const series = results.results.find(r => r.type === 'series');

if (series) {
  const details = await getSeriesDetails(session, {
    detailPath: series.raw.detailPath
  });

  console.log(`${details.title} — ${details.seasons?.length} seasons`);

  const stream = await getEpisodeStreamUrl(session, {
    detailPath: series.raw.detailPath,
    season: 1,
    episode: 1,
    quality: 'best'
  });

  console.log('Stream URL:', stream.stream?.url);

  const filePath = await downloadEpisode(session, {
    detailPath: series.raw.detailPath,
    season: 1,
    episode: 1,
    quality: 720,
    outputDir: './downloads'
  });

  console.log('Downloaded:', filePath);
}
```

## 🛠️ Development

``` bash
npm install
npm run build
npm run test
npm run lint
npm run format
```

## 🤝 Contributing

1.  Fork the repository\
2.  Create your feature branch\
3.  Run checks: `npm run lint && npm run test`\
4.  Commit your changes\
5.  Push and open a Pull Request

Please include tests and update fixtures when applicable.

## 📄 License

This project is licensed under the ISC License.

::: {align="center"}
⭐ Star this repo if you find it useful!
:::
