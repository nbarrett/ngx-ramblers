import { Request, Response } from "express";
import { envConfig } from "../../env-config/env-config";
import debug from "debug";
import { configuredBrevo } from "../brevo-config";
import {
  CreateContactRequestWithObjectAttributes,
  MailConfig
} from "../../../../projects/ngx-ramblers/src/app/models/mail.model";
import * as SibApiV3Sdk from "@getbrevo/brevo";
import http from "http";
import {
  handleError,
  mapStatusMappedResponseMultipleInputs,
  successfulResponse,
  SuccessfulResponse
} from "../common/messages";
import { UpdateBatchContacts } from "@getbrevo/brevo/model/updateBatchContacts";
import { chunk, first, omit } from "lodash";
import { ContactsApi } from "@getbrevo/brevo";

const messageType = "brevo:contacts:batch-update";
const debugLog = debug(envConfig.logNamespace(messageType));
debugLog.enabled = false;

export async function contactsBatchUpdate(req: Request, res: Response): Promise<any> {
  try {
    const MAXIMUM_BATCH_SIZE = 100;
    const EXPECTED_HTTP_RESPONSE_CODE = 204;
    const brevoConfig: MailConfig = await configuredBrevo();
    const apiInstance: ContactsApi = new SibApiV3Sdk.ContactsApi();
    const createContactRequests: CreateContactRequestWithObjectAttributes[] = req.body;
    const chunkedResponses: SuccessfulResponse[] = await Promise.all(chunk(createContactRequests, MAXIMUM_BATCH_SIZE)
      .map(async (chunkedCreateContactRequests: CreateContactRequestWithObjectAttributes[]) => {
        debugLog("createContactRequests received:", chunkedCreateContactRequests);
        apiInstance.setApiKey(SibApiV3Sdk.ContactsApiApiKeys.apiKey, brevoConfig.apiKey);
        const updateBatchContacts: UpdateBatchContacts = new SibApiV3Sdk.UpdateBatchContacts();
        updateBatchContacts.contacts = chunkedCreateContactRequests;
        debugLog("updateBatchContacts:", updateBatchContacts.contacts);
        const response: {
          response: http.IncomingMessage,
          body?: any
        } = await apiInstance.updateBatchContacts(updateBatchContacts);
        return {
          req,
          res,
          response: mapStatusMappedResponseMultipleInputs(chunkedCreateContactRequests.map(item => item.extId), response, EXPECTED_HTTP_RESPONSE_CODE),
          messageType,
          debugLog
        };
      }));
    const selectedResponse: SuccessfulResponse = chunkedResponses.find(response => response.status !== EXPECTED_HTTP_RESPONSE_CODE) || first(chunkedResponses);
    debugLog("chunkedResponses:", chunkedResponses.map(response => omit(response, "req", "res")), "selectedResponse:", omit(selectedResponse, "req", "res"));
    successfulResponse({
      req,
      res,
      response: mapStatusMappedResponseMultipleInputs(createContactRequests.map(item => item.extId), selectedResponse, EXPECTED_HTTP_RESPONSE_CODE),
      messageType,
      debugLog
    });
  } catch (error) {
    handleError(req, res, messageType, debugLog, error);
  }
}
