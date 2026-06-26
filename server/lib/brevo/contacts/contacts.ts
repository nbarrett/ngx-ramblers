import debug from "debug";
import { Request, Response } from "express";
import { handleError, successfulResponse } from "../common/messages";
import { envConfig } from "../../env-config/env-config";
import { brevoClient } from "../brevo-config";
import { scheduleBrevo } from "../common/rate-limiting";

const messageType = "brevo:contacts";
const debugLog = debug(envConfig.logNamespace(messageType));
debugLog.enabled = false;

const PAGE_LIMIT = 1000;

async function fetchAllContacts(client: any, offset: number, accumulated: any[]): Promise<any[]> {
  const response: any = await scheduleBrevo(() => client.contacts.getContacts({limit: PAGE_LIMIT, offset}));
  const page: any[] = response?.contacts ?? [];
  const combined = accumulated.concat(page);
  return page.length < PAGE_LIMIT ? combined : fetchAllContacts(client, offset + PAGE_LIMIT, combined);
}

export async function contacts(req: Request, res: Response): Promise<void> {
  try {
    const client = await brevoClient();
    const allContacts = await fetchAllContacts(client, 0, []);
    debugLog("fetched", allContacts.length, "Brevo contacts across all pages");
    successfulResponse({req, res, response: {contacts: allContacts, count: allContacts.length}, messageType, debugLog});
  } catch (error) {
    handleError(req, res, messageType, debugLog, error);
  }
}
