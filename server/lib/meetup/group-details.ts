import { Request, Response } from "express";
import { envConfig } from "../env-config/env-config";
import * as messageHandlers from "../shared/message-handlers";
import * as requestDefaults from "./request-defaults";
import debugLib from "debug";
import { Meetup } from "../../../projects/ngx-ramblers/src/app/models/system.model";
import { configuredMeetup } from "./meetup-config";
import { HeaderBuilder } from "./header-builder";
import { ContentType, HTTPRequestOptions } from "../shared/server-models";
import { TypedApiResponse } from "../../../projects/ngx-ramblers/src/app/models/api-response.model";
import { GroupDataResponse } from "./meetup-api-models";

const debug = debugLib(envConfig.logNamespace("meetup:group-details"));
debug.enabled = false;

export async function groupDetails(req?: Request, res?: Response): Promise<TypedApiResponse<GroupDataResponse>> {
  try {
    debug("groupDetails called with req supplied:", !!req, "res supplied:", !!res);
    const meetupConfig: Meetup = await configuredMeetup();
    const defaultOptions: HTTPRequestOptions = requestDefaults.createApiRequestOptions(meetupConfig);
    defaultOptions.headers = HeaderBuilder.create().withContentType(ContentType.APPLICATION_JSON).withAuthorisation(meetupConfig.accessToken).build();
    const body = {
      query: `
      query GetGroupId($urlname: String!) {
        groupByUrlname(urlname: $urlname) {
          id
          name
          description
          link
        }
      }`,
      variables: {
        urlname: meetupConfig.groupName,
      }
    };
    debug("body about to be sent:", body);
    const apiResponsePromise = messageHandlers
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
      });
    if (res) {
      apiResponsePromise
        .then(response => res.json(response))
        .catch(error => handleError(res, error));
    }
    return apiResponsePromise;
  } catch (error) {
    handleError(res, error);
  }
}

function handleError(res: Response<any, Record<string, any>>, error: Error) {
  const errorResponse = {error: "An error occurred while fetching the group details", message: error.message};
  if (res) {
    res.status(500).json(errorResponse);
  } else {
    debug(errorResponse);
  }
}
