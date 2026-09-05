import { Request, Response } from "express";
import debug from "debug";
import { envConfig } from "../env-config/env-config";
import { MemberCookie } from "../../../projects/ngx-ramblers/src/app/models/member.model";
import { WalkPhotosAddedNotificationRequest } from "../../../projects/ngx-ramblers/src/app/models/mail.model";
import { sendWalkPhotosAddedEmail } from "../brevo/transactional-mail/send-walk-photos-added-email";

const debugLog: debug.Debugger = debug(envConfig.logNamespace("walk-album-photos-added"));
debugLog.enabled = true;

export async function notifyWalkPhotosAdded(req: Request, res: Response): Promise<void> {
  const request = req.body as WalkPhotosAddedNotificationRequest;
  const uploadedByMemberId = (req.user as Partial<MemberCookie>)?.memberId || "";
  if (!request?.walkId) {
    res.status(400).json({error: "walkId is required"});
  } else if (!uploadedByMemberId && !request.contributorEmail) {
    res.status(400).json({error: "contributorEmail is required when not logged in"});
  } else {
    try {
      const response = await sendWalkPhotosAddedEmail(request, uploadedByMemberId);
      res.json(response);
    } catch (error) {
      debugLog("notifyWalkPhotosAdded failed:", error);
      res.status(500).json({error: "Could not send the photo notification", message: error?.message || error});
    }
  }
}
