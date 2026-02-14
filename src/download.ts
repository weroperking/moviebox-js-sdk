import { existsSync, mkdirSync, promises as fs } from 'node:fs';
import { dirname, join } from 'node:path';

import { getMovieDetails, normalizeDownloadOptions, selectBest, selectWorst } from './details.js';
import { MovieboxApiError } from './errors.js';
import { getEpisodeQualities, getSeriesDetails } from './series.js';
import type { MovieboxSession } from './session.js';
import type {
  DownloadMode,
  DownloadProgress,
  DownloadQuality,
  EpisodeQualities,
  MovieDetails,
  MovieDownloadOption
} from './types.js';

const DEFAULT_CHUNK_SIZE = 4 * 1024 * 1024; // 4 MiB
const DEFAULT_PARALLELISM = 4;

/**
 * Default headers required by the CDN for download requests.
 * The Referer header is mandatory — without it the server returns 403.
 */
const DOWNLOAD_HEADERS: Record<string, string> = {
  Referer: 'https://fmoviesunblocked.net/',
};

interface DownloadBaseParams {
  outputDir?: string;
  filename?: string;
  quality?: DownloadQuality;
  mode?: DownloadMode;
  parallel?: number;
  chunkSize?: number;
  keepTempParts?: boolean;
  headers?: Record<string, string>;
  onProgress?: (progress: DownloadProgress) => void;
}

interface DownloadMovieParams extends DownloadBaseParams {
  detailPath: string;
  subjectId?: string;
}

interface DownloadEpisodeParams extends DownloadBaseParams {
  detailPath: string;
  subjectId?: string;
  season: number;
  episode: number;
}

interface InternalDownloadDescriptor {
  option: MovieDownloadOption;
  title: string;
  releaseYear: number | null;
  season?: number;
  episode?: number;
}

export async function downloadMovie(
  session: MovieboxSession,
  params: DownloadMovieParams
): Promise<string> {
  const detailParams: Parameters<typeof getMovieDetails>[1] = {
    detailPath: params.detailPath
  };
  if (params.subjectId) {
    detailParams.subjectId = params.subjectId;
  }

  const details: MovieDetails = await getMovieDetails(session, detailParams);

  const descriptor: InternalDownloadDescriptor = {
    option: resolveDownloadOption(details.downloads, params.quality),
    title: details.title,
    releaseYear: details.releaseYear
  };

  const filename = params.filename ?? createMovieFilename(descriptor);
  const destination = prepareDestination(params.outputDir, filename);

  const downloadOptions: Parameters<typeof downloadMediaFile>[3] = {};
  if (params.mode) downloadOptions.mode = params.mode;
  if (params.parallel !== undefined) downloadOptions.parallel = params.parallel;
  if (params.chunkSize !== undefined) downloadOptions.chunkSize = params.chunkSize;
  if (params.keepTempParts !== undefined) downloadOptions.keepTempParts = params.keepTempParts;
  if (params.headers) downloadOptions.headers = params.headers;
  if (params.onProgress) downloadOptions.onProgress = params.onProgress;

  await downloadMediaFile(session, descriptor.option, destination, downloadOptions);

  return destination;
}

export async function downloadEpisode(
  session: MovieboxSession,
  params: DownloadEpisodeParams
): Promise<string> {
  const seriesParams: Parameters<typeof getSeriesDetails>[1] = { detailPath: params.detailPath };
  const qualityParams: Parameters<typeof getEpisodeQualities>[1] = {
    detailPath: params.detailPath,
    season: params.season,
    episode: params.episode
  };
  if (params.subjectId) {
    qualityParams.subjectId = params.subjectId;
  }

  const [seriesDetails, qualities]: [Awaited<ReturnType<typeof getSeriesDetails>>, EpisodeQualities] =
    await Promise.all([getSeriesDetails(session, seriesParams), getEpisodeQualities(session, qualityParams)]);

  const descriptor: InternalDownloadDescriptor = {
    option: resolveDownloadOption(qualities.downloads, params.quality),
    title: seriesDetails.title,
    releaseYear: seriesDetails.releaseYear,
    season: params.season,
    episode: params.episode
  };

  const filename = params.filename ?? createEpisodeFilename(descriptor);
  const destination = prepareDestination(params.outputDir, filename);

  const downloadOptions: Parameters<typeof downloadMediaFile>[3] = {};
  if (params.mode) downloadOptions.mode = params.mode;
  if (params.parallel !== undefined) downloadOptions.parallel = params.parallel;
  if (params.chunkSize !== undefined) downloadOptions.chunkSize = params.chunkSize;
  if (params.keepTempParts !== undefined) downloadOptions.keepTempParts = params.keepTempParts;
  if (params.headers) downloadOptions.headers = params.headers;
  if (params.onProgress) downloadOptions.onProgress = params.onProgress;

  await downloadMediaFile(session, descriptor.option, destination, downloadOptions);

  return destination;
}

export async function downloadMediaFile(
  session: Pick<MovieboxSession, 'fetchImpl' | 'ensureSessionCookies'>,
  option: MovieDownloadOption,
  destination: string,
  options: {
    mode?: DownloadMode;
    parallel?: number;
    chunkSize?: number;
    keepTempParts?: boolean;
    headers?: Record<string, string>;
    onProgress?: (progress: DownloadProgress) => void;
  } = {}
): Promise<void> {
  const totalBytes = option.sizeBytes ?? null;
  if (!option.url) {
    throw new MovieboxApiError('Download option does not include a URL.');
  }

  const mode = options.mode ?? 'auto';
  const parallelism = Math.max(1, options.parallel ?? DEFAULT_PARALLELISM);
  const chunkSize = Math.max(256 * 1024, options.chunkSize ?? DEFAULT_CHUNK_SIZE);

  // Merge default CDN headers with any user-supplied headers.
  // User-supplied headers take precedence over defaults.
  const downloadHeaders: Record<string, string> = {
    ...DOWNLOAD_HEADERS,
    ...(options.headers ?? {}),
  };

  await session.ensureSessionCookies();

  const directory = dirname(destination);
  if (!existsSync(directory)) {
    mkdirSync(directory, { recursive: true });
  }

  const fileHandle = await fs.open(destination, mode === 'overwrite' ? 'w+' : 'a+');
  try {
    let existingSize = 0;
    try {
      const stats = await fileHandle.stat();
      existingSize = stats.size;
    } catch {
      existingSize = 0;
    }

    if (mode === 'overwrite' && existingSize > 0) {
      await fileHandle.truncate(0);
      existingSize = 0;
    }

    if (mode === 'resume' && existingSize === 0) {
      throw new MovieboxApiError('No partial download found to resume.');
    }

    const targetSize = totalBytes ?? undefined;
    if (mode === 'auto' && targetSize !== undefined && existingSize >= targetSize) {
      return;
    }

    const startOffset = mode === 'resume' ? existingSize : 0;

    const ranges = buildRanges(startOffset, targetSize, chunkSize);
    if (ranges.length === 0) {
      return;
    }

    let downloadedBytes = startOffset;
    const notifyProgress = () => {
      if (!options.onProgress) {
        return;
      }
      const percentage = targetSize
        ? Math.min(100, Math.round((downloadedBytes / targetSize) * 1000) / 10)
        : null;
      options.onProgress({ downloadedBytes, totalBytes: targetSize ?? null, percentage });
    };

    const queue = [...ranges];
    const worker = async () => {
      while (queue.length > 0) {
        const { start, end } = queue.shift()!;
        const response = await session.fetchImpl(option.url, {
          method: 'GET',
          headers: {
            Range: `bytes=${start}-${end}`,
            ...downloadHeaders,
          }
        });

        if (response.status !== 206 && response.status !== 200) {
          throw new MovieboxApiError(`Unexpected status ${response.status} for range download.`);
        }

        const reader = response.body?.getReader();
        if (!reader) {
          throw new MovieboxApiError('Unable to read download stream.');
        }

        let offset = start;
        for (;;) {
          const chunk = await reader.read();
          if (chunk.done) {
            break;
          }
          const buffer = chunk.value;
          await fileHandle.write(buffer, 0, buffer.length, offset);
          offset += buffer.length;
          downloadedBytes += buffer.length;
          notifyProgress();
        }
      }
    };

    const workerCount = Math.min(parallelism, queue.length || 1);
    const workers = Array.from({ length: workerCount }, () => worker());
    await Promise.all(workers);
    notifyProgress();
  } finally {
    await fileHandle.close();
  }
}

function buildRanges(start: number, total: number | undefined, chunkSize: number): Array<{ start: number; end: number }> {
  const ranges: Array<{ start: number; end: number }> = [];
  const effectiveTotal = total ?? Number.POSITIVE_INFINITY;
  let offset = start;
  while (offset < effectiveTotal) {
    const end = total ? Math.min(offset + chunkSize - 1, total - 1) : offset + chunkSize - 1;
    ranges.push({ start: offset, end });
    if (total && end >= total - 1) {
      break;
    }
    offset += chunkSize;
  }
  return ranges;
}

function resolveDownloadOption(options: MovieDownloadOption[], quality: DownloadQuality = 'best'): MovieDownloadOption {
  if (!options.length) {
    throw new MovieboxApiError('No downloadable files available.');
  }

  if (quality === 'best') {
    const best = selectBest(options);
    if (!best) {
      throw new MovieboxApiError('Unable to determine best download option.');
    }
    return best;
  }

  if (quality === 'worst') {
    const worst = selectWorst(options);
    if (!worst) {
      throw new MovieboxApiError('Unable to determine worst download option.');
    }
    return worst;
  }

  const targetResolution = typeof quality === 'string' ? parseInt(quality, 10) : quality;
  if (!Number.isFinite(targetResolution)) {
    throw new MovieboxApiError('Invalid download quality specified.');
  }

  const normalized = [...options].sort((a, b) => a.resolution - b.resolution);
  const match = normalized.find((option) => option.resolution === targetResolution);
  if (!match) {
    throw new MovieboxApiError(`No download option found for ${targetResolution}p.`);
  }
  return match;
}

function createMovieFilename(descriptor: InternalDownloadDescriptor): string {
  const resolution = descriptor.option.resolution ?? 0;
  const ext = extractExtension(descriptor.option.url) ?? 'mp4';
  const year = descriptor.releaseYear ? ` ${descriptor.releaseYear}` : '';
  return `${sanitizeFilename(descriptor.title)}${year} ${resolution}p.${ext}`;
}

function createEpisodeFilename(descriptor: InternalDownloadDescriptor): string {
  const resolution = descriptor.option.resolution ?? 0;
  const ext = extractExtension(descriptor.option.url) ?? 'mp4';
  const season = descriptor.season ?? 0;
  const episode = descriptor.episode ?? 0;
  const prefix = `${sanitizeFilename(descriptor.title)} S${String(season).padStart(2, '0')}E${String(episode).padStart(2, '0')}`;
  return `${prefix} ${resolution}p.${ext}`;
}

function prepareDestination(outputDir: string | undefined, filename: string): string {
  const directory = outputDir ? join(process.cwd(), outputDir) : process.cwd();
  if (!existsSync(directory)) {
    mkdirSync(directory, { recursive: true });
  }
  return join(directory, filename);
}

function extractExtension(url: string | undefined): string | null {
  if (!url) {
    return null;
  }
  const pathname = new URL(url).pathname;
  const segment = pathname.split('/').pop() ?? '';
  const [namePart] = segment.split('?');
  const parts = (namePart ?? '').split('.');
  if (parts.length <= 1) {
    return null;
  }
  return parts.pop() ?? null;
}

function sanitizeFilename(input: string): string {
  return input.replace(/[<>:"/\\|?*]+/g, '_').trim();
}