import http from "http";

import { MailTemplate, MailTemplates } from "./mail.model";

export interface AccountResponse {
  response: http.IncomingMessage;
  body: any;
}

export interface MailTemplatesResponse {
  response: http.IncomingMessage;
  body: MailTemplates;
}

export interface MailTemplateResponse {
  response: http.IncomingMessage;
  body: MailTemplate;
}
