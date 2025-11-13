# Express Integration Example

Simple Express server exposing Moviebox search, detail, stream, and download routes.

## Usage

`ash
npm install express
npm install --save-dev @types/express
`

`ash
tsx examples/express/server.ts
`

Endpoints exposed under /api/moviebox:

- GET /api/moviebox/search?q=Inception
- GET /api/moviebox/movies/:detailPath
- GET /api/moviebox/movies/:detailPath/stream
- POST /api/moviebox/movies/:detailPath/download

Adjust session configuration (logger, proxy) as needed.
