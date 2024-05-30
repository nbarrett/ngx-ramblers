import { LoginResponse, Member, MemberCookie } from "./member.model";
import { Identifiable } from "./api-response.model";

export interface AuthCredentials {
  userName: string;
  password: string;
}

export interface RefreshToken extends Identifiable {
  refreshToken: string;
  memberPayload: Member;
}

export interface AuthResponse {
  tokens: {
    auth: string;
    refresh: string;
  };
  loginResponse: LoginResponse;
  error?: any;
}

export interface AuthPayload extends Partial<MemberCookie> {
  iat?: number;
  exp?: number;
}
