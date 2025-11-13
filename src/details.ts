import { ITEM_DETAILS_PATH } from './constants.js';
import { MovieboxApiError } from './errors.js';
import type { MovieboxSession } from './session.js';
import type {
  MovieDetails,
  MovieDownloadOption,
  MovieSubtitleOption,
  RawDownloadableFilesResponse,
  RawDownloadableMedia,
  RawMovieMetadata,
  RawMovieResData,
  RawMovieSubject,
  RawNuxtDetailState,
  RawSeriesSubject
} from './types.js';

interface GetMovieDetailsParams {
  detailPath: string;
  subjectId?: string;
}

export async function getMovieDetails(
  session: MovieboxSession,
  params: GetMovieDetailsParams
): Promise<MovieDetails> {
  const normalizedPath = normalizeDetailPath(params.detailPath);
  const html = await session.fetchHtml(normalizedPath, {
    headers: {
      Accept: 'text/html,application/xhtml+xml'
    }
  });

  const nuxtState = extractNuxtState(html);
  const resData = nuxtState.resData;
  if (!resData) {
    throw new MovieboxApiError('Moviebox detail page did not include expected resData payload.');
  }

  const subject = resData.subject;
  if (!subject?.subjectId) {
    throw new MovieboxApiError('Movie detail state is missing subject information.');
  }

  const subjectId = params.subjectId ?? subject.subjectId;

  const downloadData = await session.fetchJson<RawDownloadableFilesResponse>(
    '/wefeed-h5-bff/web/subject/download',
    {
      searchParams: {
        subjectId,
        se: 0,
        ep: 0
      },
      headers: {
        Referer: session.buildUrl(`/movies/${subject.detailPath}`)
      }
    }
  );

  return normalizeMovieDetails(resData, downloadData);
}

function normalizeMovieDetails(
  resData: RawMovieResData,
  downloads: RawDownloadableFilesResponse
): MovieDetails {
  const metadata: RawMovieMetadata = resData.metadata;
  const subject: RawMovieSubject = resData.subject;

  const releaseDate = subject.releaseDate ?? null;
  const releaseYear = releaseDate ? parseInt(releaseDate.slice(0, 4), 10) || null : null;
  const durationSource = subject.duration;
  const parsedDuration =
    typeof durationSource === 'number'
      ? durationSource
      : durationSource
        ? parseInt(durationSource, 10)
        : undefined;
  const resolvedDurationSeconds =
    typeof subject.durationSeconds === 'number'
      ? subject.durationSeconds
      : typeof parsedDuration === 'number' && Number.isFinite(parsedDuration)
        ? parsedDuration
        : null;
  const durationSeconds = resolvedDurationSeconds ?? null;
  const durationLabel = durationSource != null ? String(durationSource) : durationSeconds !== null ? String(durationSeconds) : null;
  const posterUrl = subject.cover?.url ?? null;
  const backdropUrl = metadata?.image ?? null;

  const rating = resolveRating(subject);
  const ratingCount = subject.imdbRatingCount ?? null;
  const genres = subject.genre ?? [];
  const availableSubtitleLanguages = splitDelimited(subject.subtitles ?? '')
    .map((entry) => entry.trim())
    .filter(Boolean);

  const downloadOptions = normalizeDownloadOptions(downloads.downloads);
  const captions = normalizeCaptions(downloads.captions ?? []);

  const bestDownload = selectBest(downloadOptions);
  const worstDownload = selectWorst(downloadOptions);

  return {
    id: subject.subjectId,
    detailPath: subject.detailPath,
    title: subject.title,
    synopsis: subject.description,
    releaseDate,
    releaseYear,
    durationSeconds,
    durationLabel,
    genres,
    posterUrl,
    backdropUrl,
    rating,
    ratingCount,
    country: subject.countryName ?? null,
    hasResource: Boolean(subject.hasResource ?? downloads.hasResource),
    availableSubtitleLanguages,
    downloads: downloadOptions,
    bestDownload,
    worstDownload,
    captions
  };
}

export function normalizeDownloadOptions(downloads: RawDownloadableMedia[] | undefined): MovieDownloadOption[] {
  if (!downloads?.length) {
    return [];
  }

  return downloads
    .map((media) => ({
      id: media.id,
      resolution: media.resolution,
      quality: `${media.resolution}p`,
      sizeBytes: toNumber(media.size),
      url: media.url
    }))
    .sort((a, b) => a.resolution - b.resolution);
}

export function normalizeCaptions(captions: RawDownloadableFilesResponse['captions']): MovieSubtitleOption[] {
  if (!captions?.length) {
    return [];
  }

  return captions.map((caption) => ({
    id: caption.id,
    languageCode: caption.lan,
    language: caption.lanName,
    sizeBytes: toNumber(caption.size),
    delay: caption.delay,
    url: caption.url
  }));
}

export function selectBest(downloads: MovieDownloadOption[]): MovieDownloadOption | null {
  if (!downloads.length) {
    return null;
  }
  return downloads.reduce((best, current) => (current.resolution > best.resolution ? current : best));
}

export function selectWorst(downloads: MovieDownloadOption[]): MovieDownloadOption | null {
  if (!downloads.length) {
    return null;
  }
  return downloads.reduce((worst, current) => (current.resolution < worst.resolution ? current : worst));
}

export function resolveRating(subject: RawMovieSubject | RawSeriesSubject): number | null {
  if (typeof subject.imdbRatingValue === 'number') {
    return subject.imdbRatingValue;
  }
  if (typeof subject.imdbRate === 'number') {
    return subject.imdbRate;
  }
  if (typeof subject.imdbRate === 'string') {
    const parsed = parseFloat(subject.imdbRate);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

export function splitDelimited(value: string | string[]): string[] {
  if (!value) {
    return [];
  }
  if (Array.isArray(value)) {
    return value.map((entry) => entry.trim()).filter(Boolean);
  }
  return value.split(',').map((entry) => entry.trim());
}

export function extractNuxtState(html: string): RawNuxtDetailState {
  const marker = '__NUXT_DATA__';
  const markerIndex = html.indexOf(marker);
  if (markerIndex === -1) {
    throw new MovieboxApiError('Unable to locate __NUXT_DATA__ script block.');
  }

  const scriptOpen = html.lastIndexOf('<script', markerIndex);
  if (scriptOpen === -1) {
    throw new MovieboxApiError('Malformed __NUXT_DATA__ script block.');
  }

  const scriptStart = html.indexOf('>', scriptOpen);
  const scriptEnd = html.indexOf('</script>', scriptStart);
  if (scriptStart === -1 || scriptEnd === -1) {
    throw new MovieboxApiError('Malformed __NUXT_DATA__ script block.');
  }
  const jsonText = html.slice(scriptStart + 1, scriptEnd).trim();
  if (!jsonText) {
    throw new MovieboxApiError('Moviebox detail page provided an empty nuxt payload.');
  }
  const parsed: unknown = JSON.parse(jsonText);
  const normalized = resolveNuxtPayload(parsed);
  return normalized as RawNuxtDetailState;
}

export function resolveNuxtPayload(payload: unknown): Record<string, unknown> {
  if (!Array.isArray(payload)) {
    throw new MovieboxApiError('Unexpected Nuxt payload format.');
  }

  const numericCache = new Map<number, unknown>();
  const visitedObjects = new WeakSet<object>();

  const resolveValue = (value: unknown): unknown => {
    if (typeof value === 'number' && Number.isInteger(value) && value >= 0 && value < payload.length) {
      if (numericCache.has(value)) {
        return numericCache.get(value);
      }
      const resolved = resolveValue(payload[value]);
      numericCache.set(value, resolved);
      return resolved;
    }

    if (Array.isArray(value)) {
      if (visitedObjects.has(value)) {
        return [];
      }
      visitedObjects.add(value);
      const resolvedArray = value.map((entry) => resolveValue(entry));
      visitedObjects.delete(value);
      return resolvedArray;
    }

    if (isRecord(value)) {
      if (visitedObjects.has(value)) {
        return {};
      }
      visitedObjects.add(value);
      const resolved: Record<string, unknown> = {};
      for (const [key, inner] of Object.entries(value)) {
        resolved[key] = resolveValue(inner);
      }
      visitedObjects.delete(value);
      return resolved;
    }

    return value;
  };

  const extracts: Record<string, unknown>[] = [];
  for (const entry of payload) {
    if (isRecord(entry)) {
      const resolvedEntry: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(entry)) {
        resolvedEntry[key] = resolveValue(value);
      }
      extracts.push(resolvedEntry);
    }
  }

  if (extracts.length === 0) {
    throw new MovieboxApiError('Unable to resolve Nuxt payload entries.');
  }

  const firstExtract = extracts[0];
  if (!isRecord(firstExtract) || !Object.prototype.hasOwnProperty.call(firstExtract, 'state')) {
    throw new MovieboxApiError('Nuxt state did not include expected structure.');
  }

  const stateUnknown = firstExtract['state'];
  if (!Array.isArray(stateUnknown)) {
    throw new MovieboxApiError('Nuxt state payload is not an array.');
  }

  const stateArray = stateUnknown as unknown[];
  const targetRaw = stateArray[1];
  if (!isRecord(targetRaw)) {
    throw new MovieboxApiError('Nuxt state missing detail payload.');
  }

  const normalized: Record<string, unknown> = {};
  const resolvedTarget = resolveValue(targetRaw);
  if (!isRecord(resolvedTarget)) {
    throw new MovieboxApiError('Nuxt state payload is not a record.');
  }

  for (const [key, value] of Object.entries(resolvedTarget)) {
    if (key.startsWith('$s')) {
      normalized[key.slice(2)] = value;
    }
  }
  return normalized;
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export function toNumber(value: unknown): number {
  if (typeof value === 'number') {
    return value;
  }
  if (typeof value === 'string') {
    const parsed = parseInt(value, 10);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return 0;
}

export function normalizeDetailPath(detailPath: string): string {
  if (!detailPath) {
    throw new MovieboxApiError('A detailPath is required.');
  }
  if (detailPath.startsWith('http')) {
    const url = new URL(detailPath);
    return url.pathname + (url.search ?? '');
  }
  if (detailPath.startsWith(ITEM_DETAILS_PATH)) {
    return detailPath.startsWith('/') ? detailPath : `/${detailPath}`;
  }
  return `${ITEM_DETAILS_PATH}/${detailPath}`;
}
