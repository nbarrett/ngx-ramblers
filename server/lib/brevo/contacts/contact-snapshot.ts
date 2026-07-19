import { Brevo, BrevoClient } from "@getbrevo/brevo";
import debug from "debug";
import { Request, Response } from "express";
import { isString } from "es-toolkit/compat";
import { handleError, successfulResponse } from "../common/messages";
import { envConfig } from "../../env-config/env-config";
import { brevoClient } from "../brevo-config";
import { scheduleBrevo } from "../common/rate-limiting";
import { dateTimeNowAsValue } from "../../shared/dates";
import { member } from "../../mongo/models/member";
import { brevoContactSnapshot } from "../../mongo/models/brevo-contact-snapshot";
import { BrevoEmailEvent, NumberOrString } from "../../../../projects/ngx-ramblers/src/app/models/mail.model";

const messageType = "brevo:contact-snapshot";
const debugLog = debug(envConfig.logNamespace(messageType));
debugLog.enabled = false;

const EVENTS_PER_PAGE = 100;
const EVENT_PAGE_OFFSETS = [0, 1, 2, 3, 4];
const EVENT_LOOKBACK_DAYS = 90;

async function fetchAllEvents(client: BrevoClient, email: string): Promise<BrevoEmailEvent[]> {
  const all: BrevoEmailEvent[] = [];
  for (const page of EVENT_PAGE_OFFSETS) {
    const data = await scheduleBrevo(() => client.transactionalEmails.getEmailEventReport({
      limit: EVENTS_PER_PAGE,
      offset: page * EVENTS_PER_PAGE,
      days: EVENT_LOOKBACK_DAYS,
      email,
      sort: "desc"
    }), "transactionalEmails.getEmailEventReport");
    const events: BrevoEmailEvent[] = data.events ?? [];
    all.push(...events);
    if (events.length < EVENTS_PER_PAGE) {
      break;
    }
  }
  return all;
}

async function contactInfoOrNull(client: BrevoClient, identifierString: string): Promise<Brevo.GetContactInfoResponse | null> {
  try {
    return await scheduleBrevo(() => client.contacts.getContactInfo({identifier: identifierString}), "contacts.getContactInfo");
  } catch (error: any) {
    debugLog("snapshotBrevoContact:getContactInfo failed", identifierString, error?.message || error);
    return null;
  }
}

export async function snapshotBrevoContact(identifier: NumberOrString, snapshotBy?: string, includeEvents = true): Promise<void> {
  try {
    const client = await brevoClient();
    const identifierString = isString(identifier) ? identifier : identifier.toString();
    const contactDetails: Brevo.GetContactInfoResponse | null = await contactInfoOrNull(client, identifierString);
    const email: string | null = contactDetails?.email || (identifierString.includes("@") ? identifierString : null);
    if (!email) {
      debugLog("snapshotBrevoContact:no email resolved - skipping", identifierString);
      return;
    }
    const events = includeEvents ? await fetchAllEvents(client, email) : [];
    const memberDoc = await member.findOne({ email: email.toLowerCase() }, { _id: 1 }).lean().exec() as any;
    await brevoContactSnapshot.updateOne(
      { email: email.toLowerCase() },
      {
        $set: {
          email: email.toLowerCase(),
          memberId: memberDoc?._id?.toString() ?? null,
          brevoContactId: contactDetails?.id ?? null,
          contactDetails: contactDetails ?? null,
          campaignStats: contactDetails?.statistics ?? null,
          events,
          snapshotAt: dateTimeNowAsValue(),
          snapshotBy: snapshotBy ?? null
        }
      },
      { upsert: true }
    );
    debugLog("snapshotBrevoContact:stored", email, events.length, "events");
  } catch (error: any) {
    debugLog("snapshotBrevoContact:failed", error?.message || error);
  }
}

export async function getBrevoContactSnapshot(req: Request, res: Response): Promise<void> {
  try {
    const identifier = String(req.params.identifier || "").trim().toLowerCase();
    if (!identifier) {
      res.status(400).json({ error: "identifier is required" });
      return;
    }
    const snapshot = await brevoContactSnapshot.findOne({ email: identifier }).lean().exec();
    successfulResponse({ req, res, response: snapshot ?? null, messageType, debugLog });
  } catch (error) {
    handleError(req, res, messageType, debugLog, error);
  }
}
