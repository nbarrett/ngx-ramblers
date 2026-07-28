import { ApiResponse } from "./api-response.model";

export enum SocialNetwork {
  FACEBOOK = "facebook",
  INSTAGRAM = "instagram"
}

export enum GraphApiMethod {
  GET = "get",
  POST = "post"
}

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
  publicBaseUrl?: string;
}

export interface SocialPublishJobResult {
  jobId?: string;
  results: SocialPublishResult[];
}

export interface ResolvedAlbumImage {
  image: string;
  url: string;
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
  albumName: string;
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
