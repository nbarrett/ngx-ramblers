import { ApiResponse } from "./api-response.model";

export enum SocialNetwork {
  FACEBOOK = "facebook",
  INSTAGRAM = "instagram"
}

export enum GraphApiMethod {
  GET = "get",
  POST = "post"
}

export enum FacebookPostStyle {
  LINK_PREVIEW = "link-preview",
  PHOTO_WITH_LINK = "photo-with-link"
}

export enum EventPublishOutcome {
  PUBLISHED = "published",
  REPUBLISHED = "republished",
  ALREADY_PUBLISHED = "already-published",
  UNCHANGED = "unchanged",
  FAILED = "failed"
}

export enum EventCaptionToken {
  TITLE = "title",
  DESCRIPTION = "description",
  DATE = "date",
  TIME = "time",
  START_LOCATION = "startLocation",
  DISTANCE = "distance",
  GRADE = "grade",
  LEADER = "leader",
  URL = "url"
}

export const DEFAULT_WALK_CAPTION_TEMPLATE = [
  "{title}",
  "",
  "{date} at {time}",
  "Starting from {startLocation}",
  "{distance} · {grade}",
  "",
  "{description}",
  "",
  "Full details: {url}"
].join("\n");

export const DEFAULT_SOCIAL_EVENT_CAPTION_TEMPLATE = [
  "{title}",
  "",
  "{date} at {time}",
  "Where: {startLocation}",
  "",
  "{description}",
  "",
  "Full details: {url}"
].join("\n");

export const INSTAGRAM_MIN_CAROUSEL_IMAGES = 2;
export const INSTAGRAM_MAX_CAROUSEL_IMAGES = 10;
export const INSTAGRAM_MIN_ASPECT_RATIO = 0.8;
export const INSTAGRAM_MAX_ASPECT_RATIO = 1.91;

export interface SocialPublishRequest {
  albumName: string;
  caption: string;
  imageNames?: string[];
  network?: SocialNetwork;
  publicBaseUrl?: string;
}

export interface SocialPublishProgress {
  jobId?: string;
  message: string;
  network?: SocialNetwork;
  completed?: number;
  total?: number;
  percent?: number;
  phase?: string;
}

export type SocialProgressCallback = (progress: SocialPublishProgress) => void;

export interface SocialPublishJobRequest {
  jobId: string;
  albumName: string;
  networks: SocialNetwork[];
  captions: Partial<Record<SocialNetwork, string>>;
  imageNames: string[];
  imageNamesByNetwork?: Partial<Record<SocialNetwork, string[]>>;
  publicBaseUrl?: string;
  albumUrl?: string;
}

export interface SocialPublishJobResult {
  jobId?: string;
  results: SocialPublishResult[];
}

export interface ResolvedAlbumImage {
  image: string;
  url: string;
}

export interface FacebookPagePostRequest {
  images: ResolvedAlbumImage[];
  caption: string;
  link?: string;
  postStyle?: FacebookPostStyle;
}

export interface SocialPublishResult {
  network: SocialNetwork;
  success: boolean;
  postId?: string;
  permalink?: string;
  imageCount?: number;
  error?: string;
}

export interface SocialPublishApiResponse extends ApiResponse {
  request: any;
  response?: SocialPublishResult;
}

export interface SocialPublishCaptionInput {
  writeUp?: string;
  hashtags?: string[];
  mentions?: string[];
}

export interface SocialConnectionStatus {
  network: SocialNetwork;
  connected: boolean;
  name?: string;
  error?: string;
}

export interface FacebookPageOption {
  pageId: string;
  name: string;
  pageAccessToken: string;
  instagramUserId?: string;
}

export interface FacebookPagesApiResponse extends ApiResponse {
  response?: FacebookPageOption[];
}

export interface FacebookOAuthUrl {
  url: string;
}

export interface FacebookOAuthUrlApiResponse extends ApiResponse {
  response?: FacebookOAuthUrl;
}

export interface FacebookTokenHealth {
  valid: boolean;
  neverExpires?: boolean;
  expiresAt?: number;
  error?: string;
}

export interface FacebookTokenHealthApiResponse extends ApiResponse {
  response?: FacebookTokenHealth;
}

export interface SocialConnectionStatusApiResponse extends ApiResponse {
  response?: SocialConnectionStatus;
}

export interface SocialPublication {
  id?: string;
  albumName?: string;
  eventId?: string;
  eventTitle?: string;
  captionFingerprint?: string;
  network: SocialNetwork;
  postId?: string;
  permalink?: string;
  imageCount?: number;
  imageNames?: string[];
  caption?: string;
  publishedAt: number;
}

export interface SocialPublicationsApiResponse extends ApiResponse {
  response?: SocialPublication[];
}

export interface EventCaptionInput {
  title: string;
  description?: string;
  date?: string;
  time?: string;
  startLocation?: string;
  distance?: string;
  grade?: string;
  leader?: string;
  url?: string;
}

export interface EventPublishRequest {
  eventIds: string[];
  networks?: SocialNetwork[];
  republishChanged?: boolean;
  publicBaseUrl?: string;
  captions?: Partial<Record<SocialNetwork, string>>;
}

export interface EventPublishResult {
  eventId: string;
  eventTitle?: string;
  network: SocialNetwork;
  outcome: EventPublishOutcome;
  postId?: string;
  permalink?: string;
  caption?: string;
  error?: string;
}

export interface EventPublishApiResponse extends ApiResponse {
  request: any;
  response?: EventPublishResult[];
}

export interface PublishableEvent {
  eventId: string;
  title: string;
  startDateTime: string;
  itemType: string;
  cancelled: boolean;
  imageCount: number;
  imageUrl?: string;
  imageUrls?: string[];
  url?: string;
  caption?: string;
  postStyle?: FacebookPostStyle;
  publication?: SocialPublication;
  captionChanged?: boolean;
}

export enum PublishedState {
  PUBLISHED = "Published",
  CHANGED_SINCE_PUBLISHING = "Changed since publishing",
  NOT_PUBLISHED = "Not published"
}

export interface PublishableEventRow extends PublishableEvent {
  publishedState: PublishedState;
}

export interface EventImageAttachRequest {
  eventId: string;
  awsFileName: string;
}

export interface EventImageAttachApiResponse extends ApiResponse {
  request: any;
  response?: PublishableEvent;
}

export interface PublishableEventsApiResponse extends ApiResponse {
  response?: PublishableEvent[];
}
