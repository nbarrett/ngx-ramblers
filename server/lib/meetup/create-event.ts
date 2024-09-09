import { Request, Response } from "express";
import { envConfig } from "../env-config/env-config";
import * as messageHandlers from "../shared/message-handlers";
import * as requestDefaults from "./request-defaults";
import debugLib from "debug";
import { Meetup } from "../../../projects/ngx-ramblers/src/app/models/system.model";
import { configuredMeetup } from "./meetup-config";
import { MeetupEventRequest } from "../../../projects/ngx-ramblers/src/app/models/meetup-event-request.model";
import { HeaderBuilder } from "./header-builder";
import { ContentType } from "../shared/server-models";
import { groupDetails } from "./group-details";
import { TypedApiResponse } from "../../../projects/ngx-ramblers/src/app/models/api-response.model";
import { GroupDataResponse } from "./meetup-api-models";

const debug = debugLib(envConfig.logNamespace("meetup:create-event"));
debug.enabled = true;

export async function createEvent(req: Request, res: Response): Promise<void> {
  try {
    const meetupConfig: Meetup = await configuredMeetup();
    const meetupEventRequest: MeetupEventRequest = req.body;
    const defaultOptions = requestDefaults.createApiRequestOptions(meetupConfig);
    const groupDetailsApiResponse: TypedApiResponse<GroupDataResponse> = await groupDetails();
    const mutation = `
      mutation CreateEvent($input: CreateEventInput!) {
        createEvent(input: $input) {
          event {
            id
            title
            description
            eventUrl
            dateTime
            duration
          }
        }
      }
    `;

    debug("groupId:", groupDetailsApiResponse.response.data.groupByUrlname.id);

    const variables = {
      input: {
        groupId: groupDetailsApiResponse.response.data.groupByUrlname.id,
        title: meetupEventRequest.title,
        description: meetupEventRequest.description,
        dateTime: meetupEventRequest.dateTime,
        duration: meetupEventRequest.duration,
        venueId: meetupEventRequest.venueId,
        rsvpSettings: {
          guestLimit: meetupEventRequest.guestLimit,
        },
      },
    };

    const body = {query: mutation, variables};

    defaultOptions.headers = HeaderBuilder.create().withContentType(ContentType.APPLICATION_JSON).build();

    messageHandlers
      .httpRequest({
        apiRequest: {
          hostname: defaultOptions.hostname,
          protocol: defaultOptions.protocol,
          headers: defaultOptions.headers,
          method: "POST",
          path: "/gql",
        },
        body,
        successStatusCodes: defaultOptions.successStatusCodes,
        res,
        req,
        debug,
      })
      .then(response => res.json(response))
      .catch(error => res.json(error));
  } catch (error) {
    debug(error);
    res.status(500).json({error: "An error occurred while creating the event", message: error.message});
  }
}
