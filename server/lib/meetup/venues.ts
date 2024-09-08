import { Request, Response } from "express";
import { envConfig } from "../env-config/env-config";
import debugLib from "debug";
import * as messageHandlers from "../shared/message-handlers";
import * as querystring from "querystring";
import * as requestDefaults from "./request-defaults";
import { Meetup } from "../../../projects/ngx-ramblers/src/app/models/system.model";
import { configuredMeetup } from "./meetup-config";

const debug = debugLib(envConfig.logNamespace("meetup:venues"));

export async function create(req: Request, res: Response): Promise<void> {
  const meetupConfig: Meetup = await configuredMeetup();
  const defaultOptions = requestDefaults.createApiRequestOptions(meetupConfig);
  messageHandlers.httpRequest({
    apiRequest: {
      hostname: defaultOptions.hostname,
      protocol: defaultOptions.protocol,
      headers: defaultOptions.headers,
      method: "post",
      path: `/${meetupConfig.groupName}/venues`
    },
    debug,
    successStatusCodes: defaultOptions.successStatusCodes,
    body: req.body,
    res,
    req,
  }).then(response => res.json(response))
    .catch(error => res.json(error));
}

export async function list(req: Request, res: Response): Promise<void> {
  const meetupConfig: Meetup = await configuredMeetup();
  const defaultOptions = requestDefaults.createApiRequestOptions(meetupConfig);
  messageHandlers.httpRequest({
    apiRequest: {
      hostname: defaultOptions.hostname,
      protocol: defaultOptions.protocol,
      headers: defaultOptions.headers,
      method: "get",
      path: `/find_venues/search?${querystring.stringify(req.query as any)}`,
    },
    body: req.body,
    debug,
    res,
    req
  }).then(response => res.json(response))
    .catch(error => res.json(error));
}
