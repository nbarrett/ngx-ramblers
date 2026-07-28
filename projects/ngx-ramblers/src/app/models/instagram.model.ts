import { ApiResponse } from "./api-response.model";

export interface InstagramMediaPost {
  id: string;
  media_type: string;
  media_url: string;
  permalink: string;
  username: string;
  timestamp: string;
  caption: string;
}

export interface InstagramGraphMediaChild {
  media_type?: string;
  media_url?: string;
  thumbnail_url?: string;
}

export interface InstagramGraphMediaItem {
  id: string;
  media_type: string;
  media_url?: string;
  thumbnail_url?: string;
  permalink: string;
  username: string;
  timestamp: string;
  caption?: string;
  children?: { data: InstagramGraphMediaChild[] };
}

export interface InstagramRecentMediaData {
  data: InstagramMediaPost[];
}

export interface InstagramMediaPostApiResponse extends ApiResponse {
  request: any;
  response?: InstagramRecentMediaData;
}
