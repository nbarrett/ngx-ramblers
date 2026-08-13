import debug from "debug";
import { Request, Response } from "express";
import { envConfig } from "../env-config/env-config";
import { systemConfig } from "../config/system-config";
import { SystemConfig } from "../../../projects/ngx-ramblers/src/app/models/system.model";
import {
  EventImageAttachRequest,
  EventPublishRequest,
  SocialNetwork
} from "../../../projects/ngx-ramblers/src/app/models/social-publish.model";
import {
  attachImageToEvent,
  publishableEventById,
  publishableEventFrom,
  publishableEventsBetween,
  publishEventsToNetworks
} from "./event-publish";
import { publicImageBaseUrl, requestBaseUrl } from "./public-base-url";
import { dateTimeNow } from "../shared/dates";

const debugLog = debug(envConfig.logNamespace("social:event-publish-controllers"));
debugLog.enabled = true;

export async function publishEvents(req: Request, res: Response): Promise<void> {
  const request: EventPublishRequest = req.body;
  try {
    const config: SystemConfig = await systemConfig();
    const baseUrl = request.publicBaseUrl || publicImageBaseUrl(req, config);
    const eventIds = request.eventIds || [];
    debugLog("publish events request: count:", eventIds.length, "networks:", request.networks, "republishChanged:", request.republishChanged);
    const networks = request.networks?.length ? request.networks : [SocialNetwork.FACEBOOK];
    const response = await publishEventsToNetworks(eventIds, networks, config, baseUrl, !!request.republishChanged);
    res.json({request, response});
  } catch (error) {
    debugLog("publish events error:", error);
    res.status(502).json({request, response: [], error: error?.message || String(error)});
  }
}

export async function attachEventImage(req: Request, res: Response): Promise<void> {
  const request: EventImageAttachRequest = req.body;
  try {
    const config: SystemConfig = await systemConfig();
    const baseUrl = publicImageBaseUrl(req, config);
    const event = await attachImageToEvent(request.eventId, request.awsFileName);
    const response = await publishableEventFrom(event, [], config, baseUrl, requestBaseUrl(req));
    res.json({request, response});
  } catch (error) {
    debugLog("attach event image error:", error);
    res.status(500).json({request, error: error?.message || String(error)});
  }
}

export async function publishableEvent(req: Request, res: Response): Promise<void> {
  const eventId = req.params.eventId;
  try {
    const config: SystemConfig = await systemConfig();
    const baseUrl = publicImageBaseUrl(req, config);
    const response = await publishableEventById(eventId, config, baseUrl, requestBaseUrl(req));
    if (response) {
      res.json({request: {eventId}, response});
    } else {
      res.status(404).json({request: {eventId}, error: `No event found with id ${eventId}`});
    }
  } catch (error) {
    debugLog("publishable event error:", error);
    res.status(500).json({request: {eventId}, error: error?.message || String(error)});
  }
}

export async function publishableEvents(req: Request, res: Response): Promise<void> {
  const fromDate = Number(req.query.fromDate) || dateTimeNow().toMillis();
  const toDate = Number(req.query.toDate) || dateTimeNow().plus({months: 3}).toMillis();
  try {
    const config: SystemConfig = await systemConfig();
    const baseUrl = publicImageBaseUrl(req, config);
    const response = await publishableEventsBetween(fromDate, toDate, config, baseUrl, requestBaseUrl(req));
    res.json({request: {fromDate, toDate}, response});
  } catch (error) {
    debugLog("publishable events error:", error);
    res.status(500).json({request: {fromDate, toDate}, response: [], error: error?.message || String(error)});
  }
}
