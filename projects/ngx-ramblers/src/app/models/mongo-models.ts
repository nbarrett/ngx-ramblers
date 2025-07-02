import { ApiResponse, Identifiable } from "./api-response.model";

export interface HasBody {
  body: any;
}

export interface ControllerRequest extends HasBody {
  params?: any;
}

export interface WithMongoId {
  _id?: string;
}

export interface SetUnSetDocument {
  $set?: object;
  $unset?: object;
}

export interface CriteriaAndDocument {
  criteria: WithMongoId;
  document: SetUnSetDocument;
}

export interface DeletionResponse extends Identifiable {
  deleted: boolean;
}

export interface DeletionResponseApiResponse extends ApiResponse {
  request: any;
  response?: DeletionResponse | DeletionResponse[];
}

export enum MongoSort {
  DESCENDING = -1,
  ASCENDING = 1
}
