export interface AtlasApiAccess {
  projectId?: string;
  publicKey?: string;
  privateKey?: string;
}

export interface AtlasResponse<T> {
  status: number;
  body: T | null;
}

export interface AtlasError {
  errorCode?: string;
  detail?: string;
  reason?: string;
}
