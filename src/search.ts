import type { MovieboxSession } from './session.js';
import type {
  NormalizedSearchResult,
  RawSearchData,
  RawSearchItem,
  SearchFilter,
  SearchParams,
  SearchResultPage,
  SearchResultType
} from './types.js';

const SUBJECT_FILTER_TO_CODE: Record<SearchFilter, number> = {
  all: 0,
  movie: 1,
  tv: 2,
  music: 6
};

const SUBJECT_CODE_TO_LITERAL: Record<number, SearchResultType> = {
  1: 'movie',
  2: 'tv',
  6: 'music'
};

export async function search(session: MovieboxSession, params: SearchParams): Promise<SearchResultPage> {
  const payload = {
    keyword: params.query,
    page: params.page ?? 1,
    perPage: params.perPage ?? 24,
    subjectType: SUBJECT_FILTER_TO_CODE[params.type ?? 'all'] ?? SUBJECT_FILTER_TO_CODE.all
  };

  const data = await session.postJson<RawSearchData>('/wefeed-h5-bff/web/subject/search', payload);

  const results = data.items.map((item) => normalizeSearchItem(session, item));
  const page = toInt(data.pager.page) ?? data.pager.page;
  const perPage = toInt(data.pager.perPage) ?? data.pager.perPage;
  const totalCount = toInt(data.pager.totalCount) ?? data.pager.totalCount;
  const nextPage = data.pager.hasMore ? toInt(data.pager.nextPage) : null;

  return {
    results,
    page,
    perPage,
    totalCount,
    hasMore: data.pager.hasMore,
    nextPage,
    raw: data
  };
}

function normalizeSearchItem(session: MovieboxSession, item: RawSearchItem): NormalizedSearchResult {
  const releaseYear = parseReleaseYear(item.releaseDate);
  const genres = normalizeDelimitedField(item.genre);
  const subtitles = normalizeDelimitedField(item.subtitles);
  const type = SUBJECT_CODE_TO_LITERAL[item.subjectType] ?? 'unknown';
  const posterUrl = item.image?.url ?? item.cover?.url ?? null;
  const rating = parseRating(item.imdbRatingValue);

  return {
    id: item.subjectId,
    title: item.title,
    type,
    description: item.description ?? '',
    releaseDate: item.releaseDate ?? null,
    releaseYear,
    rating,
    genres,
    country: item.countryName ?? null,
    pageUrl: session.buildDetailUrl(item.detailPath, item.subjectId),
    posterUrl,
    subtitles,
    hasResource: Boolean(item.hasResource),
    raw: item
  };
}

function parseReleaseYear(releaseDate?: string): number | null {
  if (!releaseDate) {
    return null;
  }
  const year = Number.parseInt(releaseDate.slice(0, 4), 10);
  return Number.isFinite(year) ? year : null;
}

function normalizeDelimitedField(value?: string | string[]): string[] {
  if (!value) {
    return [];
  }

  if (Array.isArray(value)) {
    return value.map((entry) => entry.trim()).filter(Boolean);
  }

  return value
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function parseRating(value: unknown): number | null {
  if (typeof value === 'number') {
    return value;
  }
  if (typeof value === 'string') {
    const parsed = parseFloat(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return null;
}

function toInt(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string') {
    const parsed = parseInt(value, 10);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return null;
}
