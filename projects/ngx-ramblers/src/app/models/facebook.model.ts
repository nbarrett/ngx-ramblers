import { ApiResponse } from "./api-response.model";

export interface FacebookPagePost {
  id: string;
  message: string;
  createdTime: string;
  permalink: string;
  imageUrl: string;
  imageCount: number;
  authorName: string;
}

export interface FacebookGraphSubAttachment {
  media?: { image?: { src?: string } };
}

export interface FacebookGraphAttachment {
  media_type?: string;
  media?: { image?: { src?: string } };
  subattachments?: { data: FacebookGraphSubAttachment[] };
}

export interface FacebookGraphPost {
  id: string;
  message?: string;
  story?: string;
  created_time?: string;
  permalink_url?: string;
  full_picture?: string;
  from?: { id?: string; name?: string };
  attachments?: { data: FacebookGraphAttachment[] };
}

export interface FacebookGraphProfile {
  name?: string;
  username?: string;
  followers_count?: number;
  fan_count?: number;
  link?: string;
  picture?: { data?: { url?: string } };
}

export interface FacebookPageProfile {
  name: string;
  username: string;
  followersCount: number;
  profilePictureUrl: string;
  link: string;
}

export interface FacebookRecentPostsData {
  data: FacebookPagePost[];
  profile?: FacebookPageProfile;
}

export interface FacebookRecentPostsApiResponse extends ApiResponse {
  request: any;
  response?: FacebookRecentPostsData;
}
