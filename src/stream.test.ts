import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import downloadMovieFixture from './__fixtures__/download-avatar.json' with { type: 'json' };
import downloadEpisodeFixture from './__fixtures__/download-merlin-s1e1.json' with { type: 'json' };
import streamEpisodeFixture from './__fixtures__/stream-merlin-s1e1.json' with { type: 'json' };
import streamMovieFixture from './__fixtures__/stream-titanic.json' with { type: 'json' };
import { MovieboxSession } from './session.js';
import { getEpisodeStreamUrl, getMovieStreamUrl } from './stream.js';

const envelope = (data: unknown) => ({ code: 0, message: 'ok', data });

const jsonResponse = (data: unknown, init: ResponseInit = {}) =>
  new Response(JSON.stringify(envelope(data)), {
    status: 200,
    headers: { 'Content-Type': 'application/json', ...(init.headers ?? {}) },
    ...init
  });

describe('stream helpers', () => {
  let fetchMock: ReturnType<typeof vi.fn<typeof fetch>>;
  let session: MovieboxSession;

  beforeEach(() => {
    fetchMock = vi.fn<typeof fetch>();
    session = new MovieboxSession({
      baseUrl: 'https://moviebox.test',
      fetch: fetchMock,
      maxRetries: 0,
      retryDelayMs: 0
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('returns movie stream URL for requested quality', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse([{ version: '1.0.0' }], { headers: { 'Set-Cookie': 'account=token; Path=/' } }))
      .mockResolvedValueOnce(jsonResponse(streamMovieFixture.data))
      .mockResolvedValueOnce(jsonResponse(downloadMovieFixture.data));

    const result = await getMovieStreamUrl(session, {
      detailPath: 'titanic-m7a9yt0abq6',
      subjectId: '5390197429792821032',
      quality: 720
    });

    expect(fetchMock).toHaveBeenCalledTimes(3);

    const streamCall = fetchMock.mock.calls[1];
    expect(streamCall).toBeDefined();
    const [streamUrl, streamInit] = streamCall!;
    expect(streamUrl).toBe('https://moviebox.test/wefeed-h5-bff/web/subject/play?subjectId=5390197429792821032&se=0&ep=0');
    expect(streamInit?.headers).toMatchObject({ Referer: 'https://moviebox.test/movies/titanic-m7a9yt0abq6' });
    expect(streamInit?.headers).toHaveProperty('Cookie');

    const downloadCall = fetchMock.mock.calls[2];
    expect(downloadCall?.[0]).toContain('/wefeed-h5-bff/web/subject/download');

    expect(result.stream?.resolution).toBe(720);
    expect(result.options.map((option) => option.resolution)).toEqual([480, 720, 1080]);
    expect(result.captions).toHaveLength(downloadMovieFixture.data.captions.length);
    expect(result.hasResource).toBe(true);
    expect(result.freeStreamsRemaining).toBe(6);
    expect(result.isLimited).toBe(false);
  });

  it('returns worst available episode stream when requested', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse([{ version: '1.0.0' }], { headers: { 'Set-Cookie': 'account=token; Path=/' } }))
      .mockResolvedValueOnce(jsonResponse(streamEpisodeFixture.data))
      .mockResolvedValueOnce(jsonResponse(downloadEpisodeFixture.data));

    const result = await getEpisodeStreamUrl(session, {
      detailPath: 'merlin-sMxCiIO6fZ9',
      subjectId: '8382755684005333552',
      season: 1,
      episode: 1,
      quality: 'worst'
    });

    expect(fetchMock).toHaveBeenCalledTimes(3);
    const streamCall = fetchMock.mock.calls[1];
    const [streamUrl, streamInit] = streamCall!;
    expect(streamUrl).toBe('https://moviebox.test/wefeed-h5-bff/web/subject/play?subjectId=8382755684005333552&se=1&ep=1');
    expect(streamInit?.headers).toMatchObject({ Referer: 'https://moviebox.test/movies/merlin-sMxCiIO6fZ9' });

    expect(result.stream?.resolution).toBe(360);
    expect(result.options).toHaveLength(2);
    expect(result.captions).toHaveLength(downloadEpisodeFixture.data.captions.length);
  });
});
