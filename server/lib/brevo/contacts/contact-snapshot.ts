import * as SibApiV3Sdk from "@getbrevo/brevo";
import debug from "debug";
import { Request, Response } from "express";
import { isString } from "es-toolkit/compat";
import { handleError, successfulResponse } from "../common/messages";
import { envConfig } from "../../env-config/env-config";
import { configuredBrevo } from "../brevo-config";
import { dateTimeNowAsValue } from "../../shared/dates";
import { member } from "../../mongo/models/member";
import { brevoContactSnapshot } from "../../mongo/models/brevo-contact-snapshot";
import { BrevoContactDetails, BrevoEmailEvent, NumberOrString } from "../../../../projects/ngx-ramblers/src/app/models/mail.model";

const messageType = "brevo:contact-snapshot";
const debugLog = debug(envConfig.logNamespace(messageType));
debugLog.enabled = false;

const EVENTS_PER_PAGE = 100;
const EVENT_PAGE_OFFSETS = [0, 1, 2, 3, 4];
const EVENT_LOOKBACK_DAYS = 90;

async function fetchAllEvents(transactionalApi: SibApiV3Sdk.TransactionalEmailsApi, email: string): Promise<BrevoEmailEvent[]> {
  const all: BrevoEmailEvent[] = [];
  for (const page of EVENT_PAGE_OFFSETS) {
    const response: { body: any } = await transactionalApi.getEmailEventReport(
      EVENTS_PER_PAGE, page * EVENTS_PER_PAGE, undefined, undefined, EVENT_LOOKBACK_DAYS, email,
      undefined, undefined, undefined, undefined, "desc");
    const events: BrevoEmailEvent[] = response.body?.events || [];
    all.push(...events);
    if (events.length < EVENTS_PER_PAGE) {
      break;
    }
  }
  return all;
}

export async function snapshotBrevoContact(identifier: NumberOrString, snapshotBy?: string): Promise<void> {
  try {
    const brevoConfig = await configuredBrevo();
    const contactsApi = new SibApiV3Sdk.ContactsApi();
    contactsApi.setApiKey(SibApiV3Sdk.ContactsApiApiKeys.apiKey, brevoConfig.apiKey);
    const identifierString = isString(identifier) ? identifier : identifier.toString();
    let contactDetails: BrevoContactDetails | null = null;
    let email: string | null = identifierString.includes("@") ? identifierString : null;
    try {
      const info: { body: any } = await contactsApi.getContactInfo(identifierString);
      contactDetails = info.body as BrevoContactDetails;
      email = contactDetails?.email || email;
    } catch (error: any) {
      debugLog("snapshotBrevoContact:getContactInfo failed", identifierString, error?.message || error);
    }
    if (!email) {
      debugLog("snapshotBrevoContact:no email resolved - skipping", identifierString);
      return;
    }
    const transactionalApi = new SibApiV3Sdk.TransactionalEmailsApi();
    transactionalApi.setApiKey(SibApiV3Sdk.TransactionalEmailsApiApiKeys.apiKey, brevoConfig.apiKey);
    const events = await fetchAllEvents(transactionalApi, email);
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
