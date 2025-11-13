import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

import fixtureDownload from './__fixtures__/download-avatar.json' with { type: 'json' };
import { getMovieDetails } from './details.js';
import { MovieboxSession } from './session.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const detailHtml = readFileSync(resolve(__dirname, '__fixtures__', 'detail-avatar.html'), 'utf8');

type FetchImplementation = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

const toUrlString = (input: RequestInfo | URL): string => {
  if (typeof input === 'string') {
    return input;
  }
  if (input instanceof URL) {
    return input.toString();
  }
  return input.url;
};

describe('getMovieDetails', () => {
  let fetchMock: ReturnType<typeof vi.fn<FetchImplementation>>;
  let session: MovieboxSession;

  beforeEach(() => {
    fetchMock = vi.fn<FetchImplementation>();
    session = new MovieboxSession({ baseUrl: 'https://moviebox.test', fetch: fetchMock });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('parses detail page metadata and download options', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(detailHtml, {
        status: 200,
        headers: { 'Content-Type': 'text/html' }
      })
    );

    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify(fixtureDownload), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      })
    );

    const details = await getMovieDetails(session, { detailPath: 'titanic-m7a9yt0abq6' });

    expect(fetchMock).toHaveBeenCalledTimes(2);

    const firstCall = fetchMock.mock.calls.at(0);
    expect(firstCall).toBeDefined();
    const [firstRequest] = firstCall!;
    const firstRequestUrl = toUrlString(firstRequest);
    expect(firstRequestUrl).toBe('https://moviebox.test/detail/titanic-m7a9yt0abq6');

    const secondCall = fetchMock.mock.calls.at(1);
    expect(secondCall).toBeDefined();
    const [secondRequest] = secondCall!;
    const secondRequestUrl = toUrlString(secondRequest);
    expect(secondRequestUrl).toContain('/wefeed-h5-bff/web/subject/download');
    expect(secondRequestUrl).toContain('subjectId=5390197429792821032');

    expect(details.title).toBe('Titanic');
    expect(details.releaseYear).toBe(1997);
    expect(details.durationSeconds).toBe(11640);
    expect(details.genres).toEqual(['Drama', 'Romance']);
    expect(details.availableSubtitleLanguages).toEqual(
      expect.arrayContaining(['English', 'Español', 'Français'])
    );

    expect(details.downloads).toHaveLength(fixtureDownload.data.downloads.length);
    expect(details.bestDownload?.resolution).toBe(1080);
    expect(details.worstDownload?.resolution).toBe(360);

    expect(details.captions).toHaveLength(fixtureDownload.data.captions.length);
    const englishCaption = details.captions.find((caption) => caption.language === 'English');
    expect(englishCaption).toBeDefined();
  });
});
