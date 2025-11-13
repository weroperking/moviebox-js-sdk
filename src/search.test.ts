/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import fixture from './__fixtures__/search-titanic.json' with { type: 'json' };
import { search } from './search.js';
import { MovieboxSession } from './session.js';

type FetchImplementation = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
type FetchMock = ReturnType<typeof vi.fn<FetchImplementation>>;

describe('search', () => {
  let fetchMock: FetchMock;
  let session: MovieboxSession;

  beforeEach(() => {
    fetchMock = vi.fn<FetchImplementation>();
    session = new MovieboxSession({ baseUrl: 'https://moviebox.test', fetch: fetchMock });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('sends a search request and normalizes results', async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify(fixture), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      })
    );

    const result = await search(session, { query: 'Titanic', type: 'movie', perPage: 4, page: 1 });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [requestInput, requestInit] = fetchMock.mock.calls[0]!;
    const requestUrl =
      typeof requestInput === 'string'
        ? requestInput
        : requestInput instanceof URL
        ? requestInput.toString()
        : requestInput.url;

    expect(requestUrl).toBe('https://moviebox.test/wefeed-h5-bff/web/subject/search');
    expect(requestInit?.method).toBe('POST');
    expect(requestInit?.headers).toMatchObject({ 'Content-Type': 'application/json' });

    const body = requestInit?.body;
    const parsedBody = typeof body === 'string' ? JSON.parse(body) : undefined;
    expect(parsedBody).toEqual({
      keyword: 'Titanic',
      page: 1,
      perPage: 4,
      subjectType: 1
    });

    expect(result.page).toBe(1);
    expect(result.perPage).toBe(5);
    expect(result.totalCount).toBe(146);
    expect(result.hasMore).toBe(true);
    expect(result.nextPage).toBe(2);
    expect(result.results).toHaveLength(5);

    const first = result.results[0];
    const second = result.results[1];
    if (!first || !second) {
      throw new Error('Search results should include at least two items for this fixture.');
    }

    expect(first.id).toBe('5390197429792821032');
    expect(first.title).toBe('Titanic');
    expect(first.type).toBe('movie');
    expect(first.releaseYear).toBe(1997);
    expect(first.genres).toEqual(['Drama', 'Romance']);
    expect(first.subtitles).toContain('English');
    expect(first.subtitles).toContain('Español');
    expect(first.pageUrl).toBe('https://moviebox.test/detail/titanic-m7a9yt0abq6?id=5390197429792821032');
    expect(first.posterUrl).toBe('https://pbcdnw.aoneroom.com/image/2025/11/01/0e68a08216fe532db1eef333150967fc.jpg');
    expect(first.rating).toBeCloseTo(7.9);

    expect(second.id).toBe('206379412718240440');
    expect(second.releaseYear).toBe(1950);
    expect(second.subtitles).toContain('English');
    expect(second.hasResource).toBe(true);
  });
});
