import { mkdtempSync, readFileSync, rmSync, promises as fsPromises } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { downloadMediaFile } from './download.js';
import type { MovieboxSession } from './session.js';
import type { MovieDownloadOption } from './types.js';

const encoder = new TextEncoder();

describe('download helpers', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'moviebox-download-'));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('downloads file in chunks with range requests', async () => {
    const content = encoder.encode('HelloWorld');
    const option: MovieDownloadOption = {
      id: '1',
      resolution: 720,
      quality: '720p',
      sizeBytes: content.length,
      url: 'https://moviebox.test/resource'
    };

    const fetchMock = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>((_, init) => {
      const rangeHeader = getHeader(init?.headers, 'Range');
      if (!rangeHeader) {
        throw new Error('Missing range header');
      }
      const match = /bytes=(\d+)-(\d+)/i.exec(rangeHeader);
      if (!match || match[1] === undefined || match[2] === undefined) {
        throw new Error(`Invalid range header: ${rangeHeader}`);
      }
      const start = Number.parseInt(match[1], 10);
      const end = Number.parseInt(match[2], 10);
      const slice = content.slice(start, Math.min(end + 1, content.length));
      return Promise.resolve(
        new Response(slice, {
          status: 206,
          headers: { 'Content-Length': String(slice.length) }
        })
      );
    });

    const session = {
      fetchImpl: fetchMock,
      ensureSessionCookies: vi.fn(() => Promise.resolve(true))
    } satisfies Pick<MovieboxSession, 'fetchImpl' | 'ensureSessionCookies'>;

    const destination = join(tempDir, 'movie.mp4');

    await downloadMediaFile(session, option, destination, {
      mode: 'overwrite',
      chunkSize: 3,
      parallel: 2
    });

    expect(fetchMock).toHaveBeenCalled();
    const data = readFileSync(destination);
    expect(Array.from(data)).toEqual(Array.from(content));
  });

  it('resumes partial downloads when mode is resume', async () => {
    const content = encoder.encode('ABCDEFGHIJ');
    const option: MovieDownloadOption = {
      id: '1',
      resolution: 480,
      quality: '480p',
      sizeBytes: content.length,
      url: 'https://moviebox.test/resource'
    };

    const destination = join(tempDir, 'episode.mp4');
    // Write first four bytes as an existing partial download
    await fsPromises.writeFile(destination, content.slice(0, 4));

    const fetchMock = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>((_, init) => {
      const rangeHeader = getHeader(init?.headers, 'Range');
      if (!rangeHeader) {
        throw new Error('Missing range header');
      }
      const match = /bytes=(\d+)-(\d+)/i.exec(rangeHeader);
      if (!match || match[1] === undefined || match[2] === undefined) {
        throw new Error(`Invalid range header: ${rangeHeader}`);
      }
      const start = Number.parseInt(match[1], 10);
      const end = Number.parseInt(match[2], 10);
      const slice = content.slice(start, Math.min(end + 1, content.length));
      return Promise.resolve(
        new Response(slice, {
          status: 206,
          headers: { 'Content-Length': String(slice.length) }
        })
      );
    });

    const session = {
      fetchImpl: fetchMock,
      ensureSessionCookies: vi.fn(() => Promise.resolve(true))
    } satisfies Pick<MovieboxSession, 'fetchImpl' | 'ensureSessionCookies'>;

    await downloadMediaFile(session, option, destination, {
      mode: 'resume',
      chunkSize: 3,
      parallel: 1
    });

    const data = readFileSync(destination);
    expect(Array.from(data)).toEqual(Array.from(content));
    expect(fetchMock).toHaveBeenCalled();
  });

  it('includes Referer header in download requests by default', async () => {
    const content = encoder.encode('Test');
    const option: MovieDownloadOption = {
      id: '1',
      resolution: 360,
      quality: '360p',
      sizeBytes: content.length,
      url: 'https://moviebox.test/resource'
    };

    const fetchMock = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>((_, init) => {
      const rangeHeader = getHeader(init?.headers, 'Range');
      if (!rangeHeader) {
        throw new Error('Missing range header');
      }
      const match = /bytes=(\d+)-(\d+)/i.exec(rangeHeader);
      if (!match || match[1] === undefined || match[2] === undefined) {
        throw new Error(`Invalid range header: ${rangeHeader}`);
      }
      const start = Number.parseInt(match[1], 10);
      const end = Number.parseInt(match[2], 10);
      const slice = content.slice(start, Math.min(end + 1, content.length));
      return Promise.resolve(
        new Response(slice, {
          status: 206,
          headers: { 'Content-Length': String(slice.length) }
        })
      );
    });

    const session = {
      fetchImpl: fetchMock,
      ensureSessionCookies: vi.fn(() => Promise.resolve(true))
    } satisfies Pick<MovieboxSession, 'fetchImpl' | 'ensureSessionCookies'>;

    const destination = join(tempDir, 'referer-test.mp4');

    await downloadMediaFile(session, option, destination, {
      mode: 'overwrite',
      chunkSize: content.length,
      parallel: 1
    });

    expect(fetchMock).toHaveBeenCalled();

    // Verify that every fetch call included the Referer header
    for (const call of fetchMock.mock.calls) {
      const init = call[1];
      const referer = getHeader(init?.headers, 'Referer');
      expect(referer).toBe('https://fmoviesunblocked.net/');
    }

    const data = readFileSync(destination);
    expect(Array.from(data)).toEqual(Array.from(content));
  });

  it('allows custom headers to override default Referer', async () => {
    const content = encoder.encode('Custom');
    const option: MovieDownloadOption = {
      id: '1',
      resolution: 360,
      quality: '360p',
      sizeBytes: content.length,
      url: 'https://moviebox.test/resource'
    };

    const customReferer = 'https://custom-referer.example.com/';

    const fetchMock = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>((_, init) => {
      const rangeHeader = getHeader(init?.headers, 'Range');
      if (!rangeHeader) {
        throw new Error('Missing range header');
      }
      const match = /bytes=(\d+)-(\d+)/i.exec(rangeHeader);
      if (!match || match[1] === undefined || match[2] === undefined) {
        throw new Error(`Invalid range header: ${rangeHeader}`);
      }
      const start = Number.parseInt(match[1], 10);
      const end = Number.parseInt(match[2], 10);
      const slice = content.slice(start, Math.min(end + 1, content.length));
      return Promise.resolve(
        new Response(slice, {
          status: 206,
          headers: { 'Content-Length': String(slice.length) }
        })
      );
    });

    const session = {
      fetchImpl: fetchMock,
      ensureSessionCookies: vi.fn(() => Promise.resolve(true))
    } satisfies Pick<MovieboxSession, 'fetchImpl' | 'ensureSessionCookies'>;

    const destination = join(tempDir, 'custom-referer-test.mp4');

    await downloadMediaFile(session, option, destination, {
      mode: 'overwrite',
      chunkSize: content.length,
      parallel: 1,
      headers: { Referer: customReferer }
    });

    expect(fetchMock).toHaveBeenCalled();

    // Verify custom Referer overrides the default
    for (const call of fetchMock.mock.calls) {
      const init = call[1];
      const referer = getHeader(init?.headers, 'Referer');
      expect(referer).toBe(customReferer);
    }

    const data = readFileSync(destination);
    expect(Array.from(data)).toEqual(Array.from(content));
  });
});

function getHeader(headers: HeadersInit | undefined, key: string): string | undefined {
  if (!headers) {
    return undefined;
  }
  const normalized = headers instanceof Headers ? headers : new Headers(headers);
  return (
    normalized.get(key) ??
    normalized.get(key.toLowerCase()) ??
    normalized.get(key.toUpperCase()) ??
    undefined
  );
}