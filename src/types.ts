export type SearchFilter = 'all' | 'movie' | 'tv' | 'music';

export type SearchResultType = 'movie' | 'tv' | 'music' | 'unknown';

export interface SearchParams {
  query: string;
  type?: SearchFilter;
  page?: number;
  perPage?: number;
}

export interface RawSearchResponseEnvelope<T> {
  code: number;
  message: string;
  data: T;
}

export interface RawSearchPager {
  hasMore: boolean;
  nextPage: number;
  page: number;
  perPage: number;
  totalCount: number;
}

export interface RawSearchImage {
  url: string;
  width?: number;
  height?: number;
  size?: number;
  format?: string;
  thumbnail?: string;
  blurHash?: string;
  gif?: string | null;
  avgHueLight?: string;
  avgHueDark?: string;
  id?: string;
}

export interface RawSearchItem {
  id: string;
  title: string;
  image: RawSearchImage;
  cover?: RawSearchImage;
  url?: string;
  subjectId: string;
  subjectType: number;
  description?: string;
  releaseDate?: string;
  genre?: string | string[];
  countryName?: string;
  imdbRatingValue?: number | null;
  detailPath: string;
  subtitles?: string | string[];
  ops?: string;
  hasResource?: boolean;
  [key: string]: unknown;
}

export interface RawSearchData {
  items: RawSearchItem[];
  pager: RawSearchPager;
  [key: string]: unknown;
}

export interface NormalizedSearchResult {
  id: string;
  title: string;
  type: SearchResultType;
  description: string;
  releaseDate: string | null;
  releaseYear: number | null;
  rating: number | null;
  genres: string[];
  country: string | null;
  pageUrl: string;
  posterUrl: string | null;
  subtitles: string[];
  hasResource: boolean;
  raw: RawSearchItem;
}

export interface SearchResultPage {
  results: NormalizedSearchResult[];
  page: number;
  perPage: number;
  totalCount: number;
  hasMore: boolean;
  nextPage: number | null;
  raw: RawSearchData;
}

export interface RawNuxtDetailState {
  resData: RawMovieResData | RawSeriesResData;
  midReviewsList?: unknown;
  [key: string]: unknown;
}

export interface RawMovieResData {
  metadata: RawMovieMetadata;
  subject: RawMovieSubject;
  resource: RawMovieResource;
  stars?: RawMovieStar[];
  pubParam?: RawMoviePubParam;
}

export interface RawSeriesResource {
  seasons: RawSeriesSeason[];
  source?: string;
  uploadBy?: string;
}

export interface RawSeriesSeason {
  allEp: string;
  maxEp: number;
  resolutions: RawSeasonResolution[];
  se: number;
}

export interface RawSeriesSubject extends RawMovieSubject {
  subjectType: number;
}

export interface RawSeriesResData {
  metadata: RawMovieMetadata;
  subject: RawSeriesSubject;
  resource: RawSeriesResource;
  stars?: RawMovieStar[];
  pubParam?: RawMoviePubParam;
}

export interface RawMovieMetadata {
  description: string;
  image: string;
  title: string;
  url: string;
}

export interface RawMovieSubject {
  subjectId: string;
  detailPath: string;
  title: string;
  description: string;
  releaseDate?: string;
  duration?: string | number;
  durationSeconds?: number;
  genre?: string[];
  countryName?: string;
  imdbRate?: string | number;
  imdbRatingValue?: number | string;
  imdbRatingCount?: number;
  cover?: RawSearchImage;
  hasResource?: boolean;
  subtitles?: string | string[];
}

export interface RawMovieResource {
  seasons: RawMovieSeason[];
  source?: string;
  uploadBy?: string;
}

export interface RawMovieSeason {
  se: number;
  maxEp: number;
  resolutions: RawSeasonResolution[];
}

export interface RawSeasonResolution {
  epNum: number;
  resolution: number;
}

export interface RawMovieStar {
  name: string;
  character?: string;
  avatarUrl?: string;
}

export interface RawMoviePubParam {
  lang: string;
  referer: string;
  url: string;
}

export interface RawDownloadableMedia {
  id: string;
  url: string;
  resolution: number;
  size: number;
}

export interface RawDownloadableCaption {
  id: string;
  lan: string;
  lanName: string;
  url: string;
  size: number;
  delay: number;
}

export interface RawDownloadableFilesResponse {
  downloads: RawDownloadableMedia[];
  captions: RawDownloadableCaption[];
  limited: boolean;
  limitedCode: string;
  hasResource: boolean;
}

export interface RawStreamFile {
  format: string;
  id: string;
  url: string;
  resolutions: number | string;
  size: number | string;
  duration: number | string;
  codecName: string;
}

export interface RawStreamResponse {
  streams: RawStreamFile[];
  freeNum: number;
  limited: boolean;
  limitedCode: string;
  dash: unknown[];
  hls: unknown[];
  hasResource: boolean;
}

export interface MovieDownloadOption {
  id: string;
  resolution: number;
  quality: string;
  sizeBytes: number;
  url: string;
}

export interface MovieSubtitleOption {
  id: string;
  languageCode: string;
  language: string;
  sizeBytes: number;
  delay: number;
  url: string;
}

export interface MovieDetails {
  id: string;
  detailPath: string;
  title: string;
  synopsis: string;
  releaseDate: string | null;
  releaseYear: number | null;
  durationSeconds: number | null;
  durationLabel: string | null;
  genres: string[];
  posterUrl: string | null;
  backdropUrl: string | null;
  rating: number | null;
  ratingCount: number | null;
  country: string | null;
  hasResource: boolean;
  availableSubtitleLanguages: string[];
  downloads: MovieDownloadOption[];
  bestDownload: MovieDownloadOption | null;
  worstDownload: MovieDownloadOption | null;
  captions: MovieSubtitleOption[];
}

export interface SeriesSeasonSummary {
  seasonNumber: number;
  episodeCount: number;
  availableResolutions: number[];
}

export interface SeriesDetails {
  id: string;
  detailPath: string;
  title: string;
  synopsis: string;
  releaseDate: string | null;
  releaseYear: number | null;
  genres: string[];
  country: string | null;
  posterUrl: string | null;
  rating: number | null;
  ratingCount: number | null;
  hasResource: boolean;
  availableSubtitleLanguages: string[];
  seasons: SeriesSeasonSummary[];
}

export type EpisodeDownloadOption = MovieDownloadOption;
export type EpisodeSubtitleOption = MovieSubtitleOption;

export interface EpisodeQualities {
  downloads: EpisodeDownloadOption[];
  bestDownload: EpisodeDownloadOption | null;
  worstDownload: EpisodeDownloadOption | null;
  captions: EpisodeSubtitleOption[];
}

export interface StreamOption {
  id: string;
  resolution: number;
  quality: string;
  sizeBytes: number;
  durationSeconds: number;
  format: string;
  codec: string;
  url: string;
}

export interface StreamResult {
  stream: StreamOption | null;
  options: StreamOption[];
  captions: MovieSubtitleOption[];
  hasResource: boolean;
  freeStreamsRemaining: number;
  isLimited: boolean;
}

export type DownloadQuality = 'best' | 'worst' | number;

export type DownloadMode = 'auto' | 'resume' | 'overwrite';

export interface DownloadProgress {
  downloadedBytes: number;
  totalBytes: number | null;
  percentage: number | null;
}
