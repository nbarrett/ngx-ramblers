import { ApiRequest } from "./api-request.model";

export interface ApiResponse {
  request: ApiRequest;
  action: ApiAction;
  response?: any;
  message?: string;
  error?: any;
  apiStatusCode?: number;
}

export interface Identifiable {
  id?: string;
}

export interface ApiResponseWrapper<T> {
  response: T;
}

export enum ApiAction {
  CREATE = "create",
  DELETE = "delete",
  QUERY = "query",
  UPDATE = "update",
  UPSERT = "upsert",
}

export enum ApiErrorCode {
  PATH_REQUIRED = "PATH_REQUIRED",
  DUPLICATE_PATH = "DUPLICATE_PATH"
}
