import { ApiRequest } from "./api-request.model";

export interface ApiResponse {
  request: ApiRequest;
  action?: ApiAction;
  serverApiRequest?: any;
  response?: any;
  message?: string;
  error?: any;
  apiStatusCode?: number;
}

export interface TypedApiResponse<T> extends ApiResponse {
  response?: T;
}

export interface Identifiable {
  id?: string;
}

export enum ApiAction {
  CREATE = "create",
  DELETE = "delete",
  QUERY = "query",
  UPDATE = "update",
  UPSERT = "upsert",
}
