export const DEFAULT_PROTOCOL = 'https';

export const MIRROR_HOSTS = [
  'h5.aoneroom.com',
  'movieboxapp.in',
  'moviebox.pk',
  'moviebox.ph',
  'moviebox.id',
  'v.moviebox.ph',
  'netnaija.video'
] as const;

export const ENV_HOST_KEY = 'MOVIEBOX_API_HOST';
export const ENV_PROXY_KEY = 'MOVIEBOX_API_PROXY';

export const ITEM_DETAILS_PATH = '/detail';

export const APP_INFO_PATH = '/wefeed-h5-bff/app/get-latest-app-pkgs';

export const DEFAULT_REQUEST_HEADERS = {
  Accept: 'application/json',
  'Accept-Language': 'en-US,en;q=0.5',
  'X-Client-Info': '{"timezone":"Africa/Nairobi"}',
  'User-Agent': 'moviebox-js-sdk/preview',
  'Content-Type': 'application/json'
} as const;
