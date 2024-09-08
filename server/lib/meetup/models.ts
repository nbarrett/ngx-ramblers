export interface HTTPRequestOptions {
  headers: Header;
  hostname: string;
  protocol: string;
  successStatusCodes: number[];
}

export interface Header {
  Authorization?: string;
  "Content-Length"?: number;
  "Content-Type"?: ContentType;
}

export enum ContentType {
  APPLICATION_FORM_URL_ENCODED = "application/x-www-form-urlencoded",
  APPLICATION_JSON = "application/json; charset=utf-8"
}
