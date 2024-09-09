import { Request, Response } from "express";
import { envConfig } from "../env-config/env-config";
import debugLib from "debug";
import moment from "moment-timezone";
import * as messageHandlers from "../shared/message-handlers";
import * as requestDefaults from "./request-defaults";
import { Meetup } from "../../../projects/ngx-ramblers/src/app/models/system.model";
import { configuredMeetup } from "./meetup-config";
import { HeaderBuilder } from "./header-builder";

import { ContentType } from "../shared/server-models";

const debug = debugLib(envConfig.logNamespace("meetup:events"));
debug.enabled = true;

function handleError(error: Error, res: Response) {
  debug("error", error);
  res.status(500).json({error});
}

export async function all(req: Request, res: Response): Promise<void> {
  try {
    const meetupConfig: Meetup = await configuredMeetup();
    const defaultOptions = requestDefaults.createApiRequestOptions(meetupConfig);
    defaultOptions.headers = HeaderBuilder.create().withContentType(ContentType.APPLICATION_JSON).withAuthorisation(meetupConfig.accessToken).build();
    debug("headers about to be sent:", defaultOptions.headers);
    const status = "PAST";
    const proQuery = `
      query {
        proNetworkByUrlname(urlname: "${meetupConfig.groupName}") {
          eventsSearch(filter: { status: ${status} }, input: { first: 20 }) {
            edges {
              node {
                id
                title
                description
                eventUrl
                dateTime
                duration
              }
            }
          }
        }
      }`;
    const proBody = {query: proQuery};


    const query = `
      query {
        groupByUrlname(urlname: "${meetupConfig.groupName}") {
          eventSearch(
            filter: {
              status: ${status},
              query: ""
            }
            input: {
              first: 20
            }
          ) {
            edges {
              node {
                id
                title
                description
                eventUrl
                dateTime
                duration
              }
            }
          }
        }
    }`;
    const body = {query};
    debug("body:", body);
    messageHandlers.httpRequest({
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
      debug
    }).then(response => res.json(response))
      .catch(error => handleError(error, res));
  } catch (error) {
    handleError(error, res);
  }
}

export async function single(req: Request, res: Response): Promise<void> {
  const meetupConfig: Meetup = await configuredMeetup();
  const defaultOptions = requestDefaults.createApiRequestOptions(meetupConfig);
  messageHandlers.httpRequest({
    apiRequest: {
      hostname: defaultOptions.hostname,
      protocol: defaultOptions.protocol,
      headers: defaultOptions.headers,
      method: "get",
      path: `/${meetupConfig.groupName}/events/${req.params.eventId}`
    },
    successStatusCodes: defaultOptions.successStatusCodes,
    res,
    req,
    debug
  }).then(response => res.json(response))
    .catch(error => res.json(error));
}

function momentInTimezone(time: string, format?: string) {
  return moment(time, format).tz("Europe/London");
}

function toConciseResponse(jsonData: any[]): any[] {
  return jsonData.map(result => {
    const returnedResult: any = {
      id: result.id,
      link: result.link,
      title: result.name,
      description: result.description,
      date: momentInTimezone(result.time).startOf("day").valueOf(),
      startTime: result.time,
    };

    if (result.duration) {
      returnedResult.endTime = result.time + result.duration;
    }
    return returnedResult;
  });
}