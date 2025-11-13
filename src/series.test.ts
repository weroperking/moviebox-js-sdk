import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import downloadFixture from './__fixtures__/download-merlin-s1e1.json' with { type: 'json' };
import { getEpisodeQualities, getSeriesDetails } from './series.js';
import { MovieboxSession } from './session.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const detailHtml = readFileSync(resolve(__dirname, '__fixtures__', 'detail-merlin.html'), 'utf8');

type FetchImplementation = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

type FetchMock = ReturnType<typeof vi.fn<FetchImplementation>>;

const toUrlString = (input: RequestInfo | URL): string => {
  if (typeof input === 'string') {
    return input;
  }
  if (input instanceof URL) {
    return input.toString();
  }
  return input.url;
};

describe('series support', () => {
  let fetchMock: FetchMock;
  let session: MovieboxSession;

  beforeEach(() => {
    fetchMock = vi.fn<FetchImplementation>();
    session = new MovieboxSession({ baseUrl: 'https://moviebox.test', fetch: fetchMock });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('extracts season metadata from series detail page', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(detailHtml, {
        status: 200,
        headers: { 'Content-Type': 'text/html' }
      })
    );

    const details = await getSeriesDetails(session, { detailPath: 'merlin-sMxCiIO6fZ9' });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [request] = fetchMock.mock.calls[0] ?? [];
    expect(request).toBeDefined();
    expect(toUrlString(request!)).toBe('https://moviebox.test/detail/merlin-sMxCiIO6fZ9');

    expect(details.id).toBe('8382755684005333552');
    expect(details.title).toBe('Merlin');
    expect(details.releaseYear).toBe(2009);
    expect(details.availableSubtitleLanguages).toEqual(
      expect.arrayContaining(['English', 'Français', 'Türkçe'])
    );

    expect(details.seasons).toHaveLength(5);
    const firstSeason = details.seasons[0];
    expect(firstSeason).toEqual({
      seasonNumber: 1,
      episodeCount: 13,
      availableResolutions: [360, 480]
    });
  });

  it('fetches episode download and caption data', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify(downloadFixture), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      })
    );

    const result = await getEpisodeQualities(session, {
      detailPath: 'merlin-sMxCiIO6fZ9',
      season: 1,
      episode: 1,
      subjectId: '8382755684005333552'
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [requestInput, requestInit] = fetchMock.mock.calls[0] ?? [];
    expect(requestInput).toBeDefined();

    const requestUrl = toUrlString(requestInput!);
    expect(requestUrl).toContain('/wefeed-h5-bff/web/subject/download');
    expect(requestUrl).toContain('subjectId=8382755684005333552');
    expect(requestUrl).toContain('se=1');
    expect(requestUrl).toContain('ep=1');
    expect(requestInit?.headers).toMatchObject({ Referer: 'https://moviebox.test/movies/merlin-sMxCiIO6fZ9' });

    expect(result.downloads).toHaveLength(downloadFixture.data.downloads.length);
    expect(result.bestDownload?.resolution).toBe(480);
    expect(result.worstDownload?.resolution).toBe(360);
    expect(result.captions).toHaveLength(downloadFixture.data.captions.length);
  });
});
