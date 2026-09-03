import { Request, Response } from "express";
import { createErrorDebugLog } from "../shared/error-debug-log";
import { errorResponse } from "../shared/error-response";
import { UnassignedCommitteeRolesResponse } from "../../../projects/ngx-ramblers/src/app/models/committee.model";
import { requireInboxConfigurationAdministrator } from "./inbox-access";
import { unassignedCommitteeRoles } from "./inbox-unassigned-roles";

const messageType = "inbox";
const errorDebugLog = createErrorDebugLog(messageType);

export async function handleUnassignedCommitteeRoles(req: Request, res: Response): Promise<void> {
  try {
    if (requireInboxConfigurationAdministrator(req, res)) {
      const unassignedRoles = await unassignedCommitteeRoles();
      const response: UnassignedCommitteeRolesResponse = {unassignedRoles, totalCount: unassignedRoles.length};
      res.json({request: {messageType}, response});
    }
  } catch (error) {
    errorDebugLog("Error detecting committee roles assigned to deleted members:", (error as Error).message);
    res.status(500).json({request: {messageType}, error: errorResponse(error)});
  }
}
