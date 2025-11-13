import express, { Request, Response, NextFunction } from 'express';

import {
  MovieboxSession,
  search,
  getMovieDetails,
  getMovieStreamUrl,
  downloadMovie,
  createLogger
} from 'moviebox-js-sdk';

const session = new MovieboxSession({
  logger: createLogger({ level: 'info', name: 'moviebox-express' })
});

const router = express.Router();

router.get('/search', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const query = String(req.query.q ?? '').trim();
    if (!query) {
      return res.status(400).json({ error: 'Missing query param "q"' });
    }
    const results = await search(session, { query });
    res.json(results);
  } catch (error) {
    next(error);
  }
});

router.get('/movies/:detailPath', async (req, res, next) => {
  try {
    const detailPath = req.params.detailPath;
    const details = await getMovieDetails(session, { detailPath });
    res.json(details);
  } catch (error) {
    next(error);
  }
});

router.get('/movies/:detailPath/stream', async (req, res, next) => {
  try {
    const detailPath = req.params.detailPath;
    const quality = req.query.quality ? Number(req.query.quality) : undefined;
    const stream = await getMovieStreamUrl(session, { detailPath, quality });
    res.json(stream);
  } catch (error) {
    next(error);
  }
});

router.post('/movies/:detailPath/download', async (req, res, next) => {
  try {
    const detailPath = req.params.detailPath;
    const filePath = await downloadMovie(session, {
      detailPath,
      outputDir: './downloads',
      quality: req.body?.quality
    });
    res.json({ filePath });
  } catch (error) {
    next(error);
  }
});

const app = express();
app.use(express.json());
app.use('/api/moviebox', router);

app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
  const message = error instanceof Error ? error.message : 'Unknown error';
  res.status(500).json({ error: message });
});

app.listen(4000, () => {
  console.log('Moviebox Express sample listening on port 4000');
});
