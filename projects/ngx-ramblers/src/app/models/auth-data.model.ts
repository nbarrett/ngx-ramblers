import { LoginResponse, MemberCookie } from "./member.model";

export interface AuthCredentials {
  userName: string;
  password: string;
}

export interface AuthResponse {
  tokens: {
    auth: string;
    refresh: string;
  };
  loginResponse: LoginResponse;
}

export interface AuthPayload extends Partial<MemberCookie> {
  iat?: number;
  exp?: number;
}
