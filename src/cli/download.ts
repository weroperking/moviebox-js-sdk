import { downloadEpisode, downloadMovie } from '../download.js';
import { MovieboxSession } from '../session.js';
import type { DownloadQuality } from '../types.js';

function printUsage(): void {
  console.log(
    `Usage:\n  tsx src/cli/download.ts movie --detail <detailPath> [--quality <best|worst|number>] [--out <dir>] [--filename <name>]\n  tsx src/cli/download.ts episode --detail <detailPath> --season <number> --episode <number> [--quality <best|worst|number>] [--out <dir>] [--filename <name>]`
  );
}

function parseArgs(argv: string[]): { command: string | null; options: Record<string, string | boolean> } {
  const [command = null, ...rest] = argv;
  const options: Record<string, string | boolean> = {};
  for (let i = 0; i < rest.length; i += 1) {
    const token = rest[i];
    if (typeof token !== 'string' || !token.startsWith('--')) {
      continue;
    }
    const key = token.slice(2);
    const value = rest[i + 1];
    if (typeof value !== 'string' || value.startsWith('--')) {
      options[key] = true;
      if (typeof value !== 'string') {
        continue;
      }
    } else {
      options[key] = value;
      i += 1;
    }
  }
  return { command, options };
}

async function run(): Promise<void> {
  const argv = process.argv.slice(2);
  if (argv.length === 0) {
    printUsage();
    process.exitCode = 1;
    return;
  }

  const { command, options } = parseArgs(argv);
  if (!command) {
    printUsage();
    process.exitCode = 1;
    return;
  }

  const quality = parseQuality(options.quality);
  const outputDir = typeof options.out === 'string' ? options.out : undefined;
  const filename = typeof options.filename === 'string' ? options.filename : undefined;
  const subjectId = typeof options.subject === 'string' ? options.subject : undefined;

  const session = new MovieboxSession();

  try {
    if (command === 'movie') {
      const detailPath = getRequired(options.detail, '--detail');
      const movieParams: Parameters<typeof downloadMovie>[1] = { detailPath };
      if (subjectId) movieParams.subjectId = subjectId;
      if (quality !== undefined) movieParams.quality = quality;
      if (outputDir) movieParams.outputDir = outputDir;
      if (filename) movieParams.filename = filename;

      const filePath = await downloadMovie(session, movieParams);
      console.log(`Movie downloaded to ${filePath}`);
      return;
    }

    if (command === 'episode') {
      const detailPath = getRequired(options.detail, '--detail');
      const season = Number.parseInt(getRequired(options.season, '--season'), 10);
      const episode = Number.parseInt(getRequired(options.episode, '--episode'), 10);

      if (Number.isNaN(season) || Number.isNaN(episode)) {
        throw new Error('Season and episode must be valid numbers.');
      }

      const episodeParams: Parameters<typeof downloadEpisode>[1] = {
        detailPath,
        season,
        episode
      };
      if (subjectId) episodeParams.subjectId = subjectId;
      if (quality !== undefined) episodeParams.quality = quality;
      if (outputDir) episodeParams.outputDir = outputDir;
      if (filename) episodeParams.filename = filename;

      const filePath = await downloadEpisode(session, episodeParams);
      console.log(`Episode downloaded to ${filePath}`);
      return;
    }

    printUsage();
    process.exitCode = 1;
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}

function parseQuality(value: unknown): DownloadQuality | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }
  const lowered = value.toLowerCase();
  if (lowered === 'best' || lowered === 'worst') {
    return lowered;
  }
  const numeric = Number.parseInt(lowered, 10);
  if (Number.isNaN(numeric)) {
    throw new Error(`Invalid quality: ${value}`);
  }
  return numeric;
}

function getRequired(value: unknown, flag: string): string {
  if (typeof value === 'string' && value.length > 0) {
    return value;
  }
  throw new Error(`Missing required flag ${flag}`);
}

void run();
