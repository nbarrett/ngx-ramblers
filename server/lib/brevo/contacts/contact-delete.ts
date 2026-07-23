import debug from "debug";
import { Request, Response } from "express";
import { handleError, mapStatusMappedResponseSingleInput, successfulResponse } from "../common/messages";
import { envConfig } from "../../env-config/env-config";
import { brevoClient } from "../brevo-config";
import {
  ContactsDeleteRequest,
  NumberOrString,
  StatusMappedResponseSingleInput
} from "../../../../projects/ngx-ramblers/src/app/models/mail.model";
import { isString } from "es-toolkit/compat";
import { scheduleBrevo } from "../common/rate-limiting";
import { reportBrevoProgress } from "../common/progress";
import { snapshotBrevoContact } from "./contact-snapshot";
import { pluraliseWithCount } from "../../shared/string-utils";

interface AuthenticatedDeleteRequest extends Request {
  user?: { memberId?: string; userName?: string };
}

const messageType = "brevo:contacts-delete";
const debugLog = debug(envConfig.logNamespace(messageType));
debugLog.enabled = true;

const EVENT_HISTORY_SNAPSHOT_LIMIT = 25;

function failedResponse(id: NumberOrString, error: any): StatusMappedResponseSingleInput {
  return {
    id,
    success: false,
    status: error?.statusCode ?? error?.rawResponse?.status ?? 0,
    message: error?.message ?? "Delete failed",
    responseBody: null
  };
}

type BrevoApiClient = Awaited<ReturnType<typeof brevoClient>>;

function alreadyGone(error: any): boolean {
  return (error?.statusCode ?? error?.rawResponse?.status) === 404;
}

async function deleteOneContact(client: BrevoApiClient, id: NumberOrString, snapshotBy: string, snapshotBeforeDelete: boolean): Promise<StatusMappedResponseSingleInput> {
  try {
    if (snapshotBeforeDelete) {
      await snapshotBrevoContact(id, snapshotBy, true);
    }
    const identifier: string = isString(id) ? encodeURIComponent(id) : id.toString();
    const response = await scheduleBrevo(() => client.contacts.deleteContact({identifier}).withRawResponse(), "contacts.deleteContact");
    return mapStatusMappedResponseSingleInput(id, response, 204);
  } catch (error: any) {
    if (alreadyGone(error)) {
      return {id, success: true, status: 404, message: "Contact no longer exists", responseBody: null};
    } else {
      debugLog("Failed to delete Brevo contact", id, error?.message || error);
      return failedResponse(id, error);
    }
  }
}

export type ContactDeleteProgressCallback = (progress: { completed: number; total: number }) => void;

export async function deleteBrevoContacts(
  ids: NumberOrString[],
  snapshotBy?: string,
  onProgress?: ContactDeleteProgressCallback,
): Promise<StatusMappedResponseSingleInput[]> {
  const client = await brevoClient();
  const total = ids.length;
  const snapshotBeforeDelete = total <= EVENT_HISTORY_SNAPSHOT_LIMIT;
  const progress = {completed: 0};
  debugLog("Processing", pluraliseWithCount(total, "contact deletion request"),
    snapshotBeforeDelete ? "with contact snapshot and event history" : `delete-only (no remote snapshot over ${EVENT_HISTORY_SNAPSHOT_LIMIT})`);
  const responses: StatusMappedResponseSingleInput[] = await Promise.all(ids.map(async id => {
    const response = await deleteOneContact(client, id, snapshotBy, snapshotBeforeDelete);
    progress.completed += 1;
    debugLog("Deleted", progress.completed, "of", total);
    onProgress?.({ completed: progress.completed, total });
    return response;
  }));
  const failures = responses.filter(response => !response.success);
  if (failures.length > 0) {
    debugLog("Completed with failures:", pluraliseWithCount(failures.length, "contact"), "of", total, "could not be deleted");
  } else {
    debugLog("Completed", responses.length, "of", pluraliseWithCount(total, "contact deletion request"));
  }
  return responses;
}

export async function contactsDelete(req: Request, res: Response): Promise<void> {
  try {
    const request: ContactsDeleteRequest = req.body;
    const snapshotBy = (req as AuthenticatedDeleteRequest).user?.userName;
    const responses: StatusMappedResponseSingleInput[] = await deleteBrevoContacts(
      request.ids,
      snapshotBy,
      ({ completed, total }) => {
        reportBrevoProgress(`Deleting ${completed} of ${pluraliseWithCount(total, "contact")}`, completed, total);
      },
    );
    successfulResponse({req, res, response: responses, messageType, debugLog});
  } catch (error) {
    handleError(req, res, messageType, debugLog, error);
  }
}
