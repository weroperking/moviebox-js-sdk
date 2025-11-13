export class MovieboxApiError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MovieboxApiError';
  }
}

export class MovieboxHttpError extends MovieboxApiError {
  readonly status: number;
  readonly url: string;

  constructor(message: string, status: number, url: string) {
    super(message);
    this.name = 'MovieboxHttpError';
    this.status = status;
    this.url = url;
  }
}

export class EmptyResponseError extends MovieboxApiError {
  constructor(url: string) {
    super(`Moviebox API returned an empty response for ${url}`);
    this.name = 'EmptyResponseError';
  }
}

export class UnsuccessfulResponseError extends MovieboxApiError {
  readonly response: unknown;

  constructor(url: string, response: unknown) {
    super(`Moviebox API reported failure for ${url}`);
    this.name = 'UnsuccessfulResponseError';
    this.response = response;
  }
}

export class GeoBlockedError extends MovieboxHttpError {
  constructor(url: string, status: number) {
    super(`Moviebox content is not available in your region for ${url}`, status, url);
    this.name = 'GeoBlockedError';
  }
}

export interface MirrorFailure {
  url: string;
  error: Error;
}

export class MirrorExhaustedError extends MovieboxApiError {
  readonly failures: MirrorFailure[];

  constructor(failures: MirrorFailure[]) {
    super('All Moviebox mirrors failed');
    this.name = 'MirrorExhaustedError';
    this.failures = failures;
  }
}

export class RetryLimitExceededError extends MovieboxApiError {
  readonly attempts: number;

  constructor(message: string, attempts: number) {
    super(message);
    this.name = 'RetryLimitExceededError';
    this.attempts = attempts;
  }
}
