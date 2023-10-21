import { Request, Response } from "express";
import { MailchimpApiError, MailchimpListsMembersResponse } from "../../../../projects/ngx-ramblers/src/app/models/mailchimp.model";
import { envConfig } from "../../env-config/env-config";
import { MailchimpConfigData, MailchimpListMembersRequest } from "../../../../projects/ngx-ramblers/src/app/models/server-models";
import { configuredMailchimp } from "../mailchimp-config";
import * as messageProcessing from "../mailchimp-message-processing";
import debug from "debug";

const messageType = "mailchimp:lists:list-members";
const debugLog = debug(envConfig.logNamespace(messageType));

export function listMembers(req: Request, res: Response): Promise<void> {

  return configuredMailchimp().then((mailchimpConfigData: MailchimpConfigData) => {
    const listId = messageProcessing.listTypeToId(req, debugLog, mailchimpConfigData.config);
    const mailchimpListMembersRequest: MailchimpListMembersRequest = {
      fields: ["list_id",
        "members.web_id",
        "members.unique_email_id",
        "members.email_address",
        "members.status",
        "members.merge_fields",
        "members.last_changed"],
      status: "subscribed",
      offset: 0,
      count: 300
    };
    return mailchimpConfigData.client.lists.getListMembersInfo(listId, mailchimpListMembersRequest).then((responseData: MailchimpListsMembersResponse) => {
      messageProcessing.successfulResponse(req, res, responseData, messageType, debugLog);
    });
  }).catch((error: MailchimpApiError) => {
    messageProcessing.unsuccessfulResponse(req, res, error, messageType, debugLog);
  });
}
