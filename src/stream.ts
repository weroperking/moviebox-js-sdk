import { extractNuxtState, normalizeCaptions, normalizeDetailPath, toNumber } from './details.js';
import { MovieboxApiError } from './errors.js';
import type { MovieboxSession } from './session.js';
import type {
  MovieSubtitleOption,
  RawDownloadableFilesResponse,
  RawMovieResData,
  RawSeriesResData,
  RawStreamFile,
  RawStreamResponse,
  StreamOption,
  StreamResult
} from './types.js';

const STREAM_PATH = '/wefeed-h5-bff/web/subject/play';
const DOWNLOAD_PATH = '/wefeed-h5-bff/web/subject/download';

type StreamQuality = 'best' | 'worst' | number | undefined;

interface BaseStreamParams {
  detailPath: string;
  subjectId?: string;
  quality?: StreamQuality;
}

interface EpisodeStreamParams extends BaseStreamParams {
  season: number;
  episode: number;
}

type MovieStreamParams = BaseStreamParams;

export async function getMovieStreamUrl(
  session: MovieboxSession,
  params: MovieStreamParams
): Promise<StreamResult> {
  const subjectId = params.subjectId ?? (await resolveSubjectIdFromDetail(session, params.detailPath));
  return fetchStream(session, {
    detailPath: params.detailPath,
    subjectId,
    season: 0,
    episode: 0,
    quality: params.quality
  });
}

export async function getEpisodeStreamUrl(
  session: MovieboxSession,
  params: EpisodeStreamParams
): Promise<StreamResult> {
  const subjectId = params.subjectId ?? (await resolveSubjectIdFromDetail(session, params.detailPath));
  return fetchStream(session, {
    detailPath: params.detailPath,
    subjectId,
    season: params.season,
    episode: params.episode,
    quality: params.quality
  });
}

async function fetchStream(
  session: MovieboxSession,
  params: { detailPath: string; subjectId: string; season: number; episode: number; quality: StreamQuality }
): Promise<StreamResult> {
  const normalizedPath = normalizeDetailPath(params.detailPath);
  const slug = extractDetailSlug(normalizedPath);
  const searchParams = {
    subjectId: params.subjectId,
    se: params.season,
    ep: params.episode
  } as const;

  const headers: Record<string, string> = {
    Referer: session.buildUrl(`/movies/${slug}`)
  };

  const streamPayload = await session.fetchJson<RawStreamResponse>(STREAM_PATH, {
    method: 'GET',
    searchParams,
    headers,
    requireCookies: true
  });

  const options = normalizeStreamOptions(streamPayload.streams);
  const stream = selectStreamOption(options, params.quality);

  const downloadPayload = await session.fetchJson<RawDownloadableFilesResponse>(DOWNLOAD_PATH, {
    method: 'GET',
    searchParams,
    headers,
    requireCookies: true
  });

  const captions: MovieSubtitleOption[] = normalizeCaptions(downloadPayload.captions ?? []);

  return {
    stream,
    options,
    captions,
    hasResource: Boolean(streamPayload.hasResource ?? downloadPayload.hasResource),
    freeStreamsRemaining: toNumber(streamPayload.freeNum),
    isLimited: Boolean(streamPayload.limited)
  };
}

function normalizeStreamOptions(streams: RawStreamFile[] | undefined): StreamOption[] {
  if (!streams?.length) {
    return [];
  }

  return streams
    .map((stream) => {
      const resolution = toNumber(stream.resolutions);
      const sizeBytes = toNumber(stream.size);
      const durationSeconds = toNumber(stream.duration);
      return {
        id: stream.id,
        resolution,
        quality: `${resolution}p`,
        sizeBytes,
        durationSeconds,
        format: stream.format,
        codec: stream.codecName,
        url: stream.url
      } satisfies StreamOption;
    })
    .sort((a, b) => a.resolution - b.resolution);
}

function selectStreamOption(options: StreamOption[], quality: StreamQuality): StreamOption | null {
  if (!options.length) {
    return null;
  }

  if (quality === undefined || quality === 'best') {
    return options[options.length - 1] ?? null;
  }

  if (quality === 'worst') {
    return options[0] ?? null;
  }

  const desired = typeof quality === 'string' ? parseInt(quality, 10) : quality;
  const match = options.find((option) => option.resolution === desired);
  if (match) {
    return match;
  }
  return options[options.length - 1] ?? null;
}

async function resolveSubjectIdFromDetail(session: MovieboxSession, detailPath: string): Promise<string> {
  const normalizedPath = normalizeDetailPath(detailPath);
  const html = await session.fetchHtml(normalizedPath, {
    headers: {
      Accept: 'text/html,application/xhtml+xml'
    }
  });

  const nuxtState = extractNuxtState(html);
  const resData = (nuxtState as { resData?: RawMovieResData | RawSeriesResData }).resData;
  const subjectId = resData?.subject?.subjectId;
  if (!subjectId) {
    throw new MovieboxApiError('Unable to resolve subjectId for stream request.');
  }
  return subjectId;
}

function extractDetailSlug(detailPath: string): string {
  const parts = detailPath.split('/').filter(Boolean);
  return parts[parts.length - 1] ?? detailPath;
}
