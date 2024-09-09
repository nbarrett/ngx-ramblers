import { Request, Response } from "express";
import { envConfig } from "../env-config/env-config";
import * as messageHandlers from "../shared/message-handlers";
import { optionalParameter } from "../shared/message-handlers";
import * as requestDefaults from "./request-defaults";
import debugLib from "debug";
import { configuredMeetup } from "./meetup-config";
import { Meetup } from "../../../projects/ngx-ramblers/src/app/models/system.model";
import { isEmpty } from "lodash";
import { HeaderBuilder } from "./header-builder";
import { ContentType, HTTPRequestOptions } from "../shared/server-models";

export async function requestAccess(req: Request, res: Response): Promise<void> {
  const debug = debugLib(envConfig.logNamespace("meetup:request-access"));
  debug.enabled = true;
  const meetupConfig: Meetup = await configuredMeetup();
  const defaultOptions = requestDefaults.createApiRequestOptions(meetupConfig);
  defaultOptions.headers = HeaderBuilder.create().withContentType(ContentType.APPLICATION_FORM_URL_ENCODED).build();
  const optionalParameters = [
    optionalParameter("client_id", meetupConfig.clientId),
    optionalParameter("client_secret", meetupConfig.clientSecret),
    optionalParameter("grant_type", "authorization_code"),
    optionalParameter("redirect_uri", meetupConfig.clientRedirectUrl),
    optionalParameter("code", req.query.code)]
    .filter(item => !isEmpty(item))
    .join("&");
  submitOAuthAccessRequest(debug, defaultOptions, optionalParameters, req, res);
}

export async function refreshToken(req: Request, res: Response): Promise<void> {
  const debug = debugLib(envConfig.logNamespace("meetup:refresh-token"));
  debug.enabled = true;
  const meetupConfig: Meetup = await configuredMeetup();
  const defaultOptions = requestDefaults.createApiRequestOptions(meetupConfig);
  defaultOptions.headers = HeaderBuilder.create().withContentType(ContentType.APPLICATION_FORM_URL_ENCODED).build();
  const optionalParameters = [
    optionalParameter("client_id", meetupConfig.clientId),
    optionalParameter("client_secret", meetupConfig.clientSecret),
    optionalParameter("grant_type", "refresh_token"),
    optionalParameter("refresh_token", req.query.refreshToken)]
    .filter(item => !isEmpty(item))
    .join("&");
  submitOAuthAccessRequest(debug, defaultOptions, optionalParameters, req, res);
}

export function submitOAuthAccessRequest(debug: debug.Debugger, defaultOptions: HTTPRequestOptions, optionalParameters: string, req: Request, res: Response) {
  messageHandlers.httpRequest({
    apiRequest: {
      hostname: "secure.meetup.com",
      protocol: defaultOptions.protocol,
      headers: defaultOptions.headers,
      method: "post",
      path: `/oauth2/access?${optionalParameters}`,
    },
    body: req.body,
    successStatusCodes: defaultOptions.successStatusCodes,
    res,
    req,
    debug
  }).then(response => res.json(response))
    .catch(error => res.json(error));
}

