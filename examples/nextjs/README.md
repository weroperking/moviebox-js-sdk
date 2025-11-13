# Next.js API Example

Minimal API route demonstrating how to proxy Moviebox stream metadata through Next.js.

## Usage

1. Copy examples/nextjs/pages/api/moviebox.ts into your Next.js project.
2. Install the SDK:
   `ash
   npm install moviebox-js-sdk
   `
3. Configure environment variables as needed (MOVIEBOX_API_PROXY, etc.).
4. Call /api/moviebox?detailPath=<slug>&quality=1080 or include season/episode params for series.
