import { Request, Response } from "express";
import { envConfig } from "../env-config/env-config";
import debugLib from "debug";
import { configuredMeetup } from "./meetup-config";
import { Meetup } from "../../../projects/ngx-ramblers/src/app/models/system.model";
import {
  MeetupRequestAuthorisationApiResponse
} from "../../../projects/ngx-ramblers/src/app/models/meetup-authorisation.model";
import { ApiAction } from "../../../projects/ngx-ramblers/src/app/models/api-response.model";

const debug = debugLib(envConfig.logNamespace("meetup:request-access"));
debug.enabled = false;

export async function requestAuthorisation(req: Request, res: Response): Promise<void> {
  try {
    const meetupConfig: Meetup = await configuredMeetup();
    debug("meetupConfig:", meetupConfig);
    if (!meetupConfig?.clientId) {
      res.status(400).json({error: "Meetup Client Id (Your Key) not configured"});
    } else if (!meetupConfig?.clientRedirectUrl) {
      res.status(400).json({error: "Meetup client Redirect URL not configured"});
    } else {
      const requestAuthorisationUrl = `https://secure.meetup.com/oauth2/authorize?client_id=${encodeURIComponent(meetupConfig.clientId)}&response_type=code&redirect_uri=${encodeURIComponent(meetupConfig.clientRedirectUrl)}`;
      debug("requestAuthorisationUrl:", requestAuthorisationUrl);
      const apiResponse: MeetupRequestAuthorisationApiResponse = {
        request: req.query,
        action: ApiAction.QUERY,
        response: {requestAuthorisationUrl}
      };
      res.json(apiResponse);
    }
  } catch (e) {
    res.json({error: e.message});
  }
}
