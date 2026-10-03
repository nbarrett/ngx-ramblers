import { NextFunction, Request, Response } from "express";
import { ConfigKey } from "../../../projects/ngx-ramblers/src/app/models/config.model";
import { MemberCookie } from "../../../projects/ngx-ramblers/src/app/models/member.model";
import { MobileAppAction, WalksConfig } from "../../../projects/ngx-ramblers/src/app/models/walks-config.model";
import { mobileAppAccessPermitted } from "../../../projects/ngx-ramblers/src/app/functions/mobile-app-access";
import { queryKey } from "../mongo/controllers/config";

async function requireMobileAccess(req: Request, res: Response, next: NextFunction, action: MobileAppAction): Promise<void> {
  try {
    const config: WalksConfig = (await queryKey(ConfigKey.WALKS))?.value;
    if (mobileAppAccessPermitted(config, action, req.user as MemberCookie || null)) {
      next();
    } else {
      res.status(403).json({error: "You do not have permission to use this mobile app feature."});
    }
  } catch (error) {
    res.status(503).json({error: "Could not check mobile app permissions. Please try again."});
  }
}

export async function requireMobileImport(req: Request, res: Response, next: NextFunction): Promise<void> {
  await requireMobileAccess(req, res, next, req.body?.recordingId ? MobileAppAction.RECORD : MobileAppAction.IMPORT);
}

export async function requireMobileEdit(req: Request, res: Response, next: NextFunction): Promise<void> {
  await requireMobileAccess(req, res, next, MobileAppAction.EDIT);
}
