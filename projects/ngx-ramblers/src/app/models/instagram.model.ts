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

export interface InstagramRecentMediaData {
  data: InstagramMediaPost[];
}

export interface InstagramMediaPostApiResponse extends ApiResponse {
  request: any;
  response?: InstagramRecentMediaData;
}
