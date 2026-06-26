import { Request, Response } from "express";
import { envConfig } from "../../env-config/env-config";
import debug from "debug";
import { brevoClient } from "../brevo-config";
import { scheduleBrevo } from "../common/rate-limiting";
import { ensureMemberContactAttributes, stripUnavailableMemberAttributes } from "./member-contact-attributes";
import { CreateContactRequestWithObjectAttributes } from "../../../../projects/ngx-ramblers/src/app/models/mail.model";
import { Brevo } from "@getbrevo/brevo";
import {
  BrevoResponse,
  handleError,
  mapStatusMappedResponseMultipleInputs,
  successfulResponse
} from "../common/messages";
import { chunk, groupBy, values } from "es-toolkit/compat";
import { fetchExistingListIds, filterToExistingListIds } from "../lists/existing-list-ids";

const messageType = "brevo:contacts:batch-update";
const debugLog = debug(envConfig.logNamespace(messageType));
debugLog.enabled = false;

const IMPORT_ACCEPTED_HTTP_RESPONSE_CODES = [200, 201, 202, 204];
const UPDATE_BATCH_CONTACT_LIMIT = 100;

function listIdsOf(request: CreateContactRequestWithObjectAttributes): number[] {
  return request.listIds ?? [];
}

export async function contactsBatchUpdate(req: Request, res: Response): Promise<any> {
  try {
    const client = await brevoClient();
    const createContactRequests: CreateContactRequestWithObjectAttributes[] = req.body;
    if (!createContactRequests || createContactRequests.length === 0) {
      successfulResponse({
        req,
        res,
        response: mapStatusMappedResponseMultipleInputs([], {rawResponse: {status: 204, statusText: "No Content"}}, ...IMPORT_ACCEPTED_HTTP_RESPONSE_CODES),
        messageType,
        debugLog
      });
      return;
    }
    const availableMemberAttributes = await ensureMemberContactAttributes();
    const existingListIds = await fetchExistingListIds(client);
    const requestsGroupedByListIds = values(groupBy(createContactRequests, request => JSON.stringify([...listIdsOf(request)].sort())));
    const groupedResponses: BrevoResponse[] = await Promise.all(requestsGroupedByListIds.map(async groupedRequests => {
      const {valid: listIds, missing: missingListIds} = filterToExistingListIds(listIdsOf(groupedRequests[0]), existingListIds);
      if (missingListIds.length > 0) {
        debugLog("list ids not present in the connected Brevo account:", missingListIds, "valid:", listIds);
      }
      if (listIds.length === 0) {
        const contacts = groupedRequests.map(request => ({
          email: request.email,
          ext_id: request.extId,
          attributes: stripUnavailableMemberAttributes(request.attributes, availableMemberAttributes) as Record<string, unknown>
        }));
        debugLog("no valid list for group - updating contact attributes only (import requires a list) for", contacts.length, "contacts");
        const batchResponses = await Promise.all(chunk(contacts, UPDATE_BATCH_CONTACT_LIMIT).map(batch =>
          scheduleBrevo(() => client.contacts.updateBatchContacts({contacts: batch}).withRawResponse())));
        return batchResponses.find(response => !IMPORT_ACCEPTED_HTTP_RESPONSE_CODES.includes(response.rawResponse.status)) ?? batchResponses[0];
      }
      const jsonBody: Brevo.ImportContactsRequest["jsonBody"] = groupedRequests.map(request => ({
        email: request.email,
        attributes: stripUnavailableMemberAttributes(request.attributes, availableMemberAttributes) as Record<string, unknown>
      }));
      const importRequest: Brevo.ImportContactsRequest = {
        jsonBody,
        updateExistingContacts: true,
        emptyContactsAttributes: false,
        disableNotification: true,
        listIds
      };
      debugLog("importContacts request for listIds", listIds, "contacts:", jsonBody.length);
      return scheduleBrevo(() => client.contacts.importContacts(importRequest).withRawResponse());
    }));
    const failedResponse = groupedResponses.find(response => !IMPORT_ACCEPTED_HTTP_RESPONSE_CODES.includes(response.rawResponse.status));
    const selectedResponse: BrevoResponse = failedResponse ?? groupedResponses[0];
    debugLog("importContacts response statuses:", groupedResponses.map(response => response.rawResponse.status));
    successfulResponse({
      req,
      res,
      response: mapStatusMappedResponseMultipleInputs(createContactRequests.map(item => item.extId), selectedResponse, ...IMPORT_ACCEPTED_HTTP_RESPONSE_CODES),
      messageType,
      debugLog
    });
  } catch (error) {
    handleError(req, res, messageType, debugLog, error);
  }
}
