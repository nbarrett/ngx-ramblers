import { Request, Response } from "express";
import { OutgoingHttpHeaders } from "http";
import debug from "debug";

export type Header = OutgoingHttpHeaders;

export interface HTTPRequestOptions {
  headers: Header;
  hostname: string;
  protocol: string;
  successStatusCodes: number[];
}

export enum ContentType {
  APPLICATION_FORM_URL_ENCODED = "application/x-www-form-urlencoded",
  APPLICATION_JSON = "application/json"
}

export interface MessageHandlerOptions<I, O> {
  apiRequest: ServerApiRequest;
  body?: any;
  debug: debug.Debugger;
  mapper?: (jsonData: I) => O;
  req?: Request;
  res?: Response;
  successStatusCodes?: number[];
}

export interface ServerApiRequest {
  headers: Header;
  path: string;
  hostname: string;
  protocol: string;
  method: string;
}
