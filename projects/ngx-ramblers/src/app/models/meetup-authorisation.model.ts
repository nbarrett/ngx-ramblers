import { ApiResponse } from "./api-response.model";

export interface MeetupRequestAuthorisationResponse {
  requestAuthorisationUrl: string;
}

export interface MeetupAuthToken {
  access_token: string;
  token_type: string;
  expires_in: number;
}

export interface MeetupAuthRefreshToken extends MeetupAuthToken {
  refresh_token: string;
}

export interface MeetupRequestAuthorisationApiResponse extends ApiResponse {
  request: any;
  response?: MeetupRequestAuthorisationResponse;
}

export interface MeetupAuthRefreshTokenApiResponse extends ApiResponse {
  request: any;
  response?: MeetupAuthRefreshToken;
}
