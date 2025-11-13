import type { Dispatcher } from 'undici';
import { ProxyAgent } from 'undici';

import {
  APP_INFO_PATH,
  DEFAULT_PROTOCOL,
  DEFAULT_REQUEST_HEADERS,
  ENV_HOST_KEY,
  ENV_PROXY_KEY,
  ITEM_DETAILS_PATH,
  MIRROR_HOSTS
} from './constants.js';
import {
  EmptyResponseError,
  GeoBlockedError,
  MirrorExhaustedError,
  MovieboxApiError,
  MovieboxHttpError,
  RetryLimitExceededError,
  UnsuccessfulResponseError
} from './errors.js';
import { createNoopLogger } from './logger.js';
import type { Logger } from './logger.js';
import type { RawSearchData, RawSearchResponseEnvelope } from './types.js';

type RequestSearchParams = Record<string, string | number | boolean | undefined>;

interface BaseFetchOptions {
  headers?: HeadersInit;
  searchParams?: RequestSearchParams;
  requireCookies?: boolean;
}

interface FetchJsonOptions extends BaseFetchOptions {
  method?: 'GET' | 'POST';
  body?: unknown;
}

type FetchHtmlOptions = BaseFetchOptions;

interface InternalRequestOptions extends BaseFetchOptions {
  method: 'GET' | 'POST';
  body?: string;
  captureCookies?: boolean;
  sendCookies?: boolean;
}

interface RetryPolicy {
  maxAttempts: number;
  delayMs: number;
  shouldRetryError: (error: Error, context: RetryContext) => boolean;
  shouldRetryResponse: (response: Response, context: RetryContext) => boolean;
}

interface RetryContext {
  attempt: number;
  maxAttempts: number;
  url: string;
  baseUrl: string;
}

export interface MovieboxSessionOptions {
  host?: string;
  protocol?: 'https' | 'http';
  baseUrl?: string;
  mirrorHosts?: readonly string[];
  defaultHeaders?: HeadersInit;
  fetch?: typeof fetch;
  maxRetries?: number;
  retryDelayMs?: number;
  retry?: {
    maxAttempts?: number;
    delayMs?: number;
    shouldRetryError?: (error: Error, context: RetryContext) => boolean;
    shouldRetryResponse?: (response: Response, context: RetryContext) => boolean;
  };
  logger?: Logger;
  proxyUrl?: string;
  dispatcher?: Dispatcher;
}

const DEFAULT_MAX_RETRIES = 2;
const DEFAULT_RETRY_DELAY_MS = 200;

export class MovieboxSession {
  readonly fetchImpl: typeof fetch;
  readonly defaultHeaders: Record<string, string>;
  readonly logger: Logger;

  private readonly baseUrls: string[];
  private currentBaseIndex = 0;
  private readonly retryPolicy: RetryPolicy;
  private readonly cookieJar = new Map<string, string>();
  private cookiesInitialized = false;
  private readonly dispatcher: Dispatcher | undefined;

  constructor(options: MovieboxSessionOptions = {}) {
    const protocol = options.protocol ?? DEFAULT_PROTOCOL;
    const declaredHost = options.host ?? getDeclaredHost();
    const candidateHosts = uniqueStrings([
      options.baseUrl ? extractHost(options.baseUrl) : undefined,
      declaredHost,
      ...(options.mirrorHosts ?? MIRROR_HOSTS)
    ]);

    const baseUrls = candidateHosts.length
      ? candidateHosts.map((host) => ensureTrailingSlash(`${protocol}://${host}`))
      : [ensureTrailingSlash(`${protocol}://${MIRROR_HOSTS[0]}`)];

    if (options.baseUrl) {
      baseUrls.unshift(ensureTrailingSlash(options.baseUrl));
    }

    this.baseUrls = uniqueStrings(baseUrls);
    if (this.baseUrls.length === 0) {
      throw new MovieboxApiError('MovieboxSession could not determine any base URLs.');
    }

    const fetchImplementation: typeof fetch | undefined = options.fetch ?? globalThis.fetch;
    if (!fetchImplementation) {
      throw new MovieboxApiError('MovieboxSession requires a fetch implementation.');
    }
    this.fetchImpl = fetchImplementation;

    const proxyUrl = options.proxyUrl ?? getDeclaredProxy();
    this.dispatcher = options.dispatcher ?? (proxyUrl ? createProxyAgent(proxyUrl) : undefined);

    this.logger = options.logger ?? createNoopLogger();

    this.defaultHeaders = {
      ...DEFAULT_REQUEST_HEADERS,
      ...normalizeHeaderRecord(options.defaultHeaders)
    };

    const retryOptions = options.retry ?? {};
    const configuredAttempts = retryOptions.maxAttempts ?? (options.maxRetries !== undefined
      ? Math.max(0, options.maxRetries) + 1
      : DEFAULT_MAX_RETRIES + 1);
    const retryDelay = retryOptions.delayMs ?? options.retryDelayMs ?? DEFAULT_RETRY_DELAY_MS;
    const errorPredicate =
      retryOptions.shouldRetryError ??
      ((error: Error, _context: RetryContext) =>
        !(error instanceof GeoBlockedError || error instanceof MirrorExhaustedError));
    const responsePredicate =
      retryOptions.shouldRetryResponse ??
      ((response: Response, _context: RetryContext) => {
        if (response.status >= 500) return true;
        if (response.status === 429 || response.status === 408) return true;
        return false;
      });
    this.retryPolicy = {
      maxAttempts: Math.max(1, configuredAttempts),
      delayMs: retryDelay,
      shouldRetryError: (error, context) => errorPredicate(error, context),
      shouldRetryResponse: (response, context) => responsePredicate(response, context)
    };
  }

  get baseUrl(): string {
    return this.baseUrls[this.currentBaseIndex] ?? this.baseUrls[0]!;
  }

  buildUrl(path: string, searchParams?: RequestSearchParams, baseUrl?: string): string {
    const root = baseUrl ?? this.baseUrls[this.currentBaseIndex];
    const url = new URL(path, root);
    if (searchParams) {
      for (const [key, value] of Object.entries(searchParams)) {
        if (value !== undefined) {
          url.searchParams.set(key, String(value));
        }
      }
    }
    return url.toString();
  }

  async fetchJson<T>(path: string, options: FetchJsonOptions = {}): Promise<T> {
    const { method = 'GET', body, headers, searchParams, requireCookies } = options;

    if (requireCookies) {
      await this.ensureSessionCookies();
    }

    const payload = body === undefined ? undefined : JSON.stringify(body);
    const requestOptions: InternalRequestOptions = {
      method,
      sendCookies: true,
      captureCookies: true
    };
    if (payload !== undefined) {
      requestOptions.body = payload;
    }
    if (headers) {
      requestOptions.headers = headers;
    }
    if (searchParams) {
      requestOptions.searchParams = searchParams;
    }

    const response = await this.performRequest(path, requestOptions);

    const raw = await response.text();

    if (!raw) {
      throw new EmptyResponseError(response.url);
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new MovieboxHttpError('Moviebox API returned invalid JSON', response.status, response.url);
    }

    return unwrapEnvelope(parsed, response.url) as T;
  }

  async postJson<T>(path: string, body: unknown, headers?: HeadersInit): Promise<T> {
    const options: FetchJsonOptions = {
      method: 'POST',
      body
    };
    if (headers) {
      options.headers = headers;
    }
    return this.fetchJson<T>(path, options);
  }

  async fetchHtml(path: string, options: FetchHtmlOptions = {}): Promise<string> {
    const requestOptions: InternalRequestOptions = {
      method: 'GET',
      headers: {
        Accept: 'text/html,application/xhtml+xml',
        ...normalizeHeaderRecord(options.headers)
      },
      sendCookies: true,
      captureCookies: true
    };
    if (options.searchParams) {
      requestOptions.searchParams = options.searchParams;
    }

    const response = await this.performRequest(path, requestOptions);

    const html = await response.text();
    if (!html) {
      throw new EmptyResponseError(response.url);
    }

    return html;
  }

  buildDetailUrl(detailPath: string, subjectId: string): string {
    const relative = `${ITEM_DETAILS_PATH}/${detailPath}?id=${subjectId}`;
    return this.buildUrl(relative);
  }

  async ensureSessionCookies(): Promise<boolean> {
    if (this.cookiesInitialized) {
      return this.cookieJar.size > 0;
    }

    const response = await this.performRequest(
      APP_INFO_PATH,
      {
        method: 'GET',
        searchParams: { app_name: 'moviebox' },
        sendCookies: true,
        captureCookies: true
      },
      { skipMirrorAdvance: false, skipRetryLoop: false }
    );

    try {
      await response.arrayBuffer();
    } catch {
      // ignore drain errors
    }

    this.cookiesInitialized = true;
    return this.cookieJar.size > 0;
  }

  private async performRequest(
    path: string,
    options: InternalRequestOptions,
    control: { skipMirrorAdvance?: boolean; skipRetryLoop?: boolean } = {}
  ): Promise<Response> {
    const { skipMirrorAdvance = false, skipRetryLoop = false } = control;
    const failures: { url: string; error: Error }[] = [];

    for (let mirrorOffset = 0; mirrorOffset < this.baseUrls.length; mirrorOffset += 1) {
      const baseIndex = (this.currentBaseIndex + mirrorOffset) % this.baseUrls.length;
      const baseUrl = this.baseUrls[baseIndex]!;
      const requestUrl = this.buildUrl(path, options.searchParams, baseUrl);

      this.logger.debug({ baseUrl, path, attempt: mirrorOffset + 1 }, 'attempting request via mirror');

      const attemptResponse = await this.attemptWithRetries(path, baseUrl, options, skipRetryLoop).catch((error: unknown) => {
        const normalized = asError(error);
        if (normalized instanceof GeoBlockedError) {
          throw normalized;
        }
        failures.push({ url: requestUrl, error: normalized });
        this.logger.warn({ baseUrl, error: normalized.message }, 'request via mirror failed');
        return null;
      });

      if (!attemptResponse) {
        continue;
      }

      if (!skipMirrorAdvance) {
        this.currentBaseIndex = baseIndex;
      }

      if (options.captureCookies !== false) {
        this.storeResponseCookies(attemptResponse);
      }

      this.logger.debug({ baseUrl, path }, 'request succeeded');
      return attemptResponse;
    }

    this.logger.error({ failures }, 'all mirrors exhausted');
    throw new MirrorExhaustedError(failures);
  }

  private async attemptWithRetries(
    path: string,
    baseUrl: string,
    options: InternalRequestOptions,
    skipRetryLoop: boolean
  ): Promise<Response> {
    const maxAttempts = skipRetryLoop ? 1 : this.retryPolicy.maxAttempts;
    let attempt = 0;
    let lastError: Error | undefined;

    while (attempt < maxAttempts) {
      attempt += 1;
      try {
        const response = await this.executeSingleRequest(path, baseUrl, options);
        if (response.status === 451 || response.status === 403) {
          this.logger.warn({ status: response.status, url: response.url }, 'geo-blocked response');
          throw new GeoBlockedError(response.url, response.status);
        }
        if (!response.ok) {
          const context: RetryContext = {
            attempt,
            maxAttempts,
            url: response.url,
            baseUrl
          };
          const shouldRetry = attempt < maxAttempts && this.shouldRetryResponse(response, context);
          if (shouldRetry) {
            this.logger.warn({ status: response.status, attempt, baseUrl }, 'retrying after response status');
            await delay(this.retryPolicy.delayMs);
            continue;
          }
          throw new MovieboxHttpError(
            `Moviebox API request failed with status ${response.status}`,
            response.status,
            response.url
          );
        }
        return response;
      } catch (error) {
        lastError = asError(error);
        if (lastError instanceof GeoBlockedError) {
          throw lastError;
        }

        const context: RetryContext = {
          attempt,
          maxAttempts,
          url: this.buildUrl(path, options.searchParams, baseUrl),
          baseUrl
        };
        const shouldRetry = attempt < maxAttempts && this.retryPolicy.shouldRetryError(lastError, context);
        if (shouldRetry) {
          this.logger.warn({ attempt, baseUrl, error: lastError.message }, 'retrying after error');
          await delay(this.retryPolicy.delayMs);
          continue;
        }
        break;
      }
    }

    if (lastError) {
      if (!skipRetryLoop && maxAttempts > 1) {
        throw new RetryLimitExceededError(lastError.message, maxAttempts - 1);
      }
      throw lastError;
    }
    throw new MovieboxApiError('Unknown error while contacting Moviebox API');
  }

  private async executeSingleRequest(
    path: string,
    baseUrl: string,
    options: InternalRequestOptions
  ): Promise<Response> {
    const url = this.buildUrl(path, options.searchParams, baseUrl);
    const initHeaders = {
      ...this.defaultHeaders,
      ...normalizeHeaderRecord(options.headers)
    };

    if (options.sendCookies !== false && this.cookieJar.size > 0) {
      initHeaders.Cookie = serializeCookies(this.cookieJar);
    }

    if (options.body !== undefined && !('Content-Type' in initHeaders)) {
      initHeaders['Content-Type'] = 'application/json';
    }

    const requestInit: RequestInit = {
      method: options.method,
      headers: initHeaders
    };
    if (options.body !== undefined) {
      requestInit.body = options.body;
    }

    if (this.dispatcher) {
      (requestInit as { dispatcher?: Dispatcher }).dispatcher = this.dispatcher;
    }

    const response = await this.fetchImpl(url, requestInit);
    return response;
  }

  private storeResponseCookies(response: Response): void {
    const setCookieValues = getSetCookieValues(response.headers);
    for (const cookie of setCookieValues) {
      const [pair] = cookie.split(';');
      if (!pair) {
        continue;
      }
      const [rawName, ...rawValueParts] = pair.split('=');
      const name = rawName?.trim();
      const value = rawValueParts.join('=').trim();
      if (!name) {
        continue;
      }
      if (!value) {
        this.cookieJar.delete(name);
        continue;
      }
      this.cookieJar.set(name, value);
    }
  }

  private shouldRetryResponse(response: Response, context: RetryContext): boolean {
    return this.retryPolicy.shouldRetryResponse(response, context);
  }
}

function unwrapEnvelope(payload: unknown, url: string) {
  if (
    payload &&
    typeof payload === 'object' &&
    'code' in payload &&
    typeof (payload as RawSearchResponseEnvelope<RawSearchData>).code === 'number'
  ) {
    const envelope = payload as RawSearchResponseEnvelope<unknown>;
    if (envelope.code === 0 && envelope.message === 'ok' && 'data' in envelope) {
      return envelope.data;
    }
    throw new UnsuccessfulResponseError(url, payload);
  }
  return payload;
}

function ensureTrailingSlash(baseUrl: string): string {
  return baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
}

function getDeclaredHost(): string | undefined {
  if (typeof process !== 'undefined' && process.env) {
    return process.env[ENV_HOST_KEY];
  }
  return undefined;
}

function getDeclaredProxy(): string | undefined {
  if (typeof process !== 'undefined' && process.env) {
    return process.env[ENV_PROXY_KEY];
  }
  return undefined;
}

function extractHost(url: string | undefined): string | undefined {
  if (!url) {
    return undefined;
  }
  try {
    return new URL(url).host;
  } catch {
    return undefined;
  }
}

function uniqueStrings<T extends string | undefined>(values: readonly T[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    if (!value) {
      continue;
    }
    if (!seen.has(value)) {
      seen.add(value);
      result.push(value);
    }
  }
  return result;
}

function normalizeHeaderRecord(headers?: HeadersInit): Record<string, string> {
  if (!headers) {
    return {};
  }
  if (Array.isArray(headers)) {
    return Object.fromEntries(headers);
  }
  if (headers instanceof Headers) {
    const result: Record<string, string> = {};
    headers.forEach((value, key) => {
      result[key] = value;
    });
    return result;
  }
  return { ...headers };
}

function serializeCookies(jar: Map<string, string>): string {
  return Array.from(jar.entries())
    .map(([name, value]) => `${name}=${value}`)
    .join('; ');
}

function getSetCookieValues(headers: Headers): string[] {
  const headerWithRaw = headers as Headers & { raw?: () => Record<string, string[]> };
  const rawFn = headerWithRaw.raw;
  if (typeof rawFn === 'function') {
    const raw = rawFn.call(headerWithRaw);
    const setCookie = raw['set-cookie'];
    if (Array.isArray(setCookie)) {
      return setCookie;
    }
  }
  const single = headers.get('set-cookie');
  return single ? [single] : [];
}

async function delay(ms: number): Promise<void> {
  if (ms <= 0) {
    return;
  }
  await new Promise((resolve) => setTimeout(resolve, ms));
}

function asError(value: unknown): Error {
  if (value instanceof Error) {
    return value;
  }
  return new Error(String(value));
}

function createProxyAgent(proxyUrl: string): Dispatcher | undefined {
  try {
    return new ProxyAgent(proxyUrl);
  } catch {
    // if proxy URL invalid, surface error later without blocking session creation
    return undefined;
  }
}
