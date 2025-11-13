import {
  extractNuxtState,
  normalizeCaptions,
  normalizeDetailPath,
  normalizeDownloadOptions,
  resolveRating,
  selectBest,
  selectWorst,
  splitDelimited,
  toNumber
} from './details.js';
import { MovieboxApiError } from './errors.js';
import type { MovieboxSession } from './session.js';
import type {
  EpisodeQualities,
  RawDownloadableFilesResponse,
  RawSeriesResData,
  RawSeriesSeason,
  RawSeriesSubject,
  SeriesDetails,
  SeriesSeasonSummary
} from './types.js';

interface GetSeriesDetailsParams {
  detailPath: string;
}

interface GetEpisodeQualitiesParams {
  detailPath: string;
  season: number;
  episode: number;
  subjectId?: string;
}

export async function getSeriesDetails(
  session: MovieboxSession,
  params: GetSeriesDetailsParams
): Promise<SeriesDetails> {
  const normalizedPath = normalizeDetailPath(params.detailPath);
  const html = await session.fetchHtml(normalizedPath, {
    headers: {
      Accept: 'text/html,application/xhtml+xml'
    }
  });

  const nuxtState = extractNuxtState(html);
  const resData = isRawSeriesResData(nuxtState.resData) ? nuxtState.resData : undefined;
  if (!resData?.subject?.subjectId) {
    throw new MovieboxApiError('Series detail state is missing subject information.');
  }

  return normalizeSeriesDetails(resData);
}

export async function getEpisodeQualities(
  session: MovieboxSession,
  params: GetEpisodeQualitiesParams
): Promise<EpisodeQualities> {
  const slug = extractDetailSlug(params.detailPath);
  const normalizedPath = normalizeDetailPath(params.detailPath);
  const subjectId =
    params.subjectId ?? (await resolveSubjectId(session, normalizedPath));

  const downloadData = await session.fetchJson<RawDownloadableFilesResponse>(
    '/wefeed-h5-bff/web/subject/download',
    {
      searchParams: {
        subjectId,
        se: params.season,
        ep: params.episode
      },
      headers: {
        Referer: session.buildUrl(`/movies/${slug}`)
      }
    }
  );

  return normalizeEpisodeQualities(downloadData);
}

function normalizeSeriesDetails(resData: RawSeriesResData): SeriesDetails {
  const subject = resData.subject;
  const releaseDate = subject.releaseDate ?? null;
  const releaseYear = releaseDate ? parseInt(releaseDate.slice(0, 4), 10) || null : null;
  const posterUrl = subject.cover?.url ?? null;
  const rating = resolveRating(subject);
  const ratingCount = typeof subject.imdbRatingCount === 'number' ? subject.imdbRatingCount : null;
  const genres = subject.genre ?? [];
  const availableSubtitles = splitDelimited(subject.subtitles ?? []);
  const seasons = normalizeSeasons(resData.resource?.seasons ?? []);

  return {
    id: subject.subjectId,
    detailPath: subject.detailPath,
    title: subject.title,
    synopsis: subject.description,
    releaseDate,
    releaseYear,
    genres,
    country: subject.countryName ?? null,
    posterUrl,
    rating,
    ratingCount,
    hasResource: Boolean(subject.hasResource),
    availableSubtitleLanguages: availableSubtitles,
    seasons
  };
}

function normalizeSeasons(seasons: RawSeriesSeason[]): SeriesSeasonSummary[] {
  return seasons
    .map((season) => {
      const resolutions = (season.resolutions ?? [])
        .map((entry) => entry.resolution)
        .filter((resolution) => Number.isFinite(resolution));

      const uniqueResolutions = Array.from(new Set(resolutions)).sort((a, b) => a - b);

      return {
        seasonNumber: season.se,
        episodeCount: toNumber(season.maxEp),
        availableResolutions: uniqueResolutions
      };
    })
    .sort((a, b) => a.seasonNumber - b.seasonNumber);
}

function normalizeEpisodeQualities(data: RawDownloadableFilesResponse): EpisodeQualities {
  const downloads = normalizeDownloadOptions(data.downloads);
  const captions = normalizeCaptions(data.captions);

  return {
    downloads,
    bestDownload: selectBest(downloads),
    worstDownload: selectWorst(downloads),
    captions
  };
}

async function resolveSubjectId(session: MovieboxSession, normalizedPath: string): Promise<string> {
  const html = await session.fetchHtml(normalizedPath, {
    headers: {
      Accept: 'text/html,application/xhtml+xml'
    }
  });

  const nuxtState = extractNuxtState(html);
  const resData = isRawSeriesResData(nuxtState.resData) ? nuxtState.resData : undefined;
  const subjectId = resData?.subject?.subjectId;
  if (!subjectId) {
    throw new MovieboxApiError('Unable to resolve subjectId for episode download request.');
  }
  return subjectId;
}

function extractDetailSlug(detailPath: string): string {
  const parts = detailPath.split('/').filter(Boolean);
  return parts.at(-1) ?? detailPath;
}

function isRawSeriesResData(value: unknown): value is RawSeriesResData {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const candidate = value as Partial<RawSeriesResData>;
  const subject = candidate.subject as Partial<RawSeriesSubject> | undefined;
  return Boolean(subject && typeof subject.subjectId === 'string' && typeof subject.detailPath === 'string');
}
