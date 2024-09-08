import { Request, Response } from "express";
import { envConfig } from "../env-config/env-config";
import * as messageHandlers from "../shared/message-handlers";
import * as requestDefaults from "./request-defaults";
import debugLib from "debug";
import { Meetup } from "../../../projects/ngx-ramblers/src/app/models/system.model";
import { configuredMeetup } from "./meetup-config";

const debug = debugLib(envConfig.logNamespace("meetup:event-delete"));

export async function deleteEvent(req: Request, res: Response): Promise<void> {
  const meetupConfig: Meetup = await configuredMeetup();
  const defaultOptions = requestDefaults.createApiRequestOptions(meetupConfig);
  messageHandlers.httpRequest({
    apiRequest: {
      hostname: defaultOptions.hostname,
      protocol: defaultOptions.protocol,
      headers: defaultOptions.headers,
      method: "delete",
      path: `/${meetupConfig.groupName}/events/${req.params.eventId}`
    },
    successStatusCodes: defaultOptions.successStatusCodes,
    res,
    req,
    debug
  }).then(response => res.json(response))
    .catch(error => res.json(error));
}
