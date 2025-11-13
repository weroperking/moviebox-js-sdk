import type { NextApiRequest, NextApiResponse } from 'next';

import {
  MovieboxSession,
  getEpisodeStreamUrl,
  getMovieStreamUrl,
  createLogger
} from 'moviebox-js-sdk';

const session = new MovieboxSession({
  logger: createLogger({ level: 'warn', name: 'moviebox-nextjs' })
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const detailPath = String(req.query.detailPath ?? '');
    if (!detailPath) {
      return res.status(400).json({ error: 'Missing detailPath' });
    }

    const quality = req.query.quality ? Number(req.query.quality) : 'best';

    if (req.query.season && req.query.episode) {
      const stream = await getEpisodeStreamUrl(session, {
        detailPath,
        season: Number(req.query.season),
        episode: Number(req.query.episode),
        quality
      });
      return res.status(200).json(stream);
    }

    const stream = await getMovieStreamUrl(session, { detailPath, quality });
    return res.status(200).json(stream);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
}
