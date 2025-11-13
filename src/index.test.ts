import { describe, expect, it } from 'vitest';

import { MovieboxSession, getMovieDetails, search } from './index.js';

describe('package exports', () => {
  it('exposes session and helpers', () => {
    expect(typeof MovieboxSession).toBe('function');
    expect(typeof search).toBe('function');
    expect(typeof getMovieDetails).toBe('function');
  });
});
