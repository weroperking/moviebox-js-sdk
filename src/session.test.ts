import type { Dispatcher } from 'undici';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { GeoBlockedError, MirrorExhaustedError } from './errors.js';
import { createNoopLogger } from './logger.js';
import { MovieboxSession } from './session.js';

const envelope = (data: unknown) => ({ code: 0, message: 'ok', data });

const jsonResponse = (data: unknown, init: ResponseInit = {}) =>
  new Response(JSON.stringify(envelope(data)), {
    status: 200,
    headers: { 'Content-Type': 'application/json', ...(init.headers ?? {}) },
    ...init
  });

describe('MovieboxSession', () => {
  let fetchMock: ReturnType<typeof vi.fn<typeof fetch>>;

  beforeEach(() => {
    fetchMock = vi.fn<typeof fetch>();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('falls back to alternate mirrors when the primary host fails', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('network error'));
    fetchMock.mockResolvedValueOnce(jsonResponse({ ok: true }));

    const session = new MovieboxSession({
      host: 'primary.example',
      mirrorHosts: ['primary.example', 'secondary.example'],
      protocol: 'https',
      fetch: fetchMock,
      retry: { maxAttempts: 0, delayMs: 0 }
    });

    const result = await session.fetchJson<{ ok: boolean }>('/resource');

    expect(result).toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1]?.[0]).toBe('https://secondary.example/resource');
  });

  it('stores set-cookie headers and replays cookies on subsequent requests', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ ok: true }, { headers: { 'Set-Cookie': 'account=test-token; Path=/' } })
    );
    fetchMock.mockResolvedValueOnce(jsonResponse({ ok: true }));

    const session = new MovieboxSession({ baseUrl: 'https://moviebox.test', fetch: fetchMock });

    await session.fetchJson('/first');
    await session.fetchJson('/second');

    const requestHeaders = fetchMock.mock.calls[1]?.[1]?.headers as Record<string, string> | undefined;
    expect(requestHeaders?.Cookie).toContain('account=test-token');
  });

  it('ensures session cookies by calling the app info endpoint when requested', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(
        [
          { version: '1.0.0' }
        ],
        { headers: { 'Set-Cookie': 'account=appinfo; Path=/' } }
      )
    );
    fetchMock.mockResolvedValueOnce(jsonResponse({ ok: true }));

    const session = new MovieboxSession({ baseUrl: 'https://moviebox.test', fetch: fetchMock });

    const hasCookies = await session.ensureSessionCookies();
    expect(hasCookies).toBe(true);

    await session.fetchJson('/needs-cookies');

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0]?.[0]).toContain('/wefeed-h5-bff/app/get-latest-app-pkgs');
    const secondHeaders = fetchMock.mock.calls[1]?.[1]?.headers as Record<string, string> | undefined;
    expect(secondHeaders?.Cookie).toContain('account=appinfo');
  });

  it('throws MirrorExhaustedError when all mirrors fail', async () => {
    fetchMock.mockRejectedValue(new TypeError('network failure'));

    const session = new MovieboxSession({
      host: 'primary.example',
      mirrorHosts: ['primary.example', 'secondary.example'],
      protocol: 'https',
      fetch: fetchMock,
      retry: { maxAttempts: 0, delayMs: 0 }
    });

    await expect(session.fetchJson('/resource')).rejects.toBeInstanceOf(MirrorExhaustedError);
  });

  it('throws GeoBlockedError on 451 responses', async () => {
    fetchMock.mockResolvedValue(
      new Response('', {
        status: 451,
        headers: { 'Content-Type': 'application/json' }
      })
    );

    const session = new MovieboxSession({ baseUrl: 'https://moviebox.test', fetch: fetchMock });

    await expect(session.fetchJson('/geo')).rejects.toBeInstanceOf(GeoBlockedError);
  });

  it('emits debug logs when logger provided', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ ok: true }));
    const logger = {
      ...createNoopLogger(),
      debug: vi.fn(),
      warn: vi.fn(),
      error: vi.fn()
    };

    const session = new MovieboxSession({ baseUrl: 'https://moviebox.test', fetch: fetchMock, logger });
    await session.fetchJson('/logging');

    expect(logger.debug).toHaveBeenCalled();
    expect(logger.error).not.toHaveBeenCalled();
  });

  it('applies proxy dispatcher when proxyUrl provided', async () => {
    const dispatcher = Symbol('dispatcher');
    fetchMock.mockResolvedValueOnce(jsonResponse({ ok: true }));

    const session = new MovieboxSession({
      baseUrl: 'https://moviebox.test',
      fetch: fetchMock,
      dispatcher: dispatcher as unknown as Dispatcher
    });

    await session.fetchJson('/proxy-check');
    const init = fetchMock.mock.calls[0]?.[1];
    expect((init as { dispatcher: unknown }).dispatcher).toBe(dispatcher);
  });

  it('reads proxy configuration from environment variable', async () => {
    vi.stubEnv('MOVIEBOX_API_PROXY', 'http://proxy.local:8080');
    fetchMock.mockResolvedValueOnce(jsonResponse({ ok: true }));

    const session = new MovieboxSession({ baseUrl: 'https://moviebox.test', fetch: fetchMock });
    await session.fetchJson('/env-proxy');

    const init = fetchMock.mock.calls[0]?.[1];
    expect(init && 'dispatcher' in init).toBe(true);

    vi.unstubAllEnvs();
  });
});
