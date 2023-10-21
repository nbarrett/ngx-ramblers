import { ErrorResponse, lists } from "@mailchimp/mailchimp_marketing";
import { Request, Response } from "express";
import { MailchimpApiError } from "../../../../projects/ngx-ramblers/src/app/models/mailchimp.model";
import { envConfig } from "../../env-config/env-config";
import { MailchimpConfigData } from "../../../../projects/ngx-ramblers/src/app/models/server-models";
import { configuredMailchimp } from "../mailchimp-config";
import * as messageProcessing from "../mailchimp-message-processing";
import BatchListMembersOpts = lists.BatchListMembersOpts;
import BatchListMembersResponse = lists.BatchListMembersResponse;
import BatchListMembersBody = lists.BatchListMembersBody;
import debug from "debug";

const messageType = "mailchimp:campaigns:batch-subscribe";
const debugLog = debug(envConfig.logNamespace(messageType));

export function listsBatchSubscribe(req: Request, res: Response): Promise<any> {

  return configuredMailchimp().then((config: MailchimpConfigData) => {
    const listId = messageProcessing.listTypeToId(req, debugLog, config.config);
    const options: BatchListMembersOpts = {
      skipMergeValidation: false,
      skipDuplicateCheck: false
    };
    const body: BatchListMembersBody = {members: req.body, update_existing: true};
    return config.client.lists.batchListMembers(listId, body, options).then((responseData: BatchListMembersResponse) => {
      messageProcessing.successfulResponse(req, res, responseData, messageType, debugLog);
    });
  }).catch((error: MailchimpApiError) => {
    messageProcessing.unsuccessfulResponse(req, res, error, messageType, debugLog);
  });

}
