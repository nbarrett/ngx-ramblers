import * as http from "http";
import { Brevo } from "@getbrevo/brevo";

export interface SendTransactionalEmailResult {
  response: http.IncomingMessage | null;
  body: Brevo.SendTransacEmailResponse;
  renderedHtmlContent: string;
}
