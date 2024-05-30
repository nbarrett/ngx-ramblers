import * as common from "./auth-common";
import { refreshToken } from "../models/refresh-token";
import debug from "debug";
import { Request, Response } from "express";
import { envConfig } from "../../env-config/env-config";
import * as authConfig from "../../auth/auth-config";
import { RefreshToken } from "../../../../projects/ngx-ramblers/src/app/models/auth-data.model";
import * as crudController from "./crud-controller";
import { MemberCookie } from "../../../../projects/ngx-ramblers/src/app/models/member.model";

const debugLog = debug(envConfig.logNamespace("auth"));
debugLog.enabled = true;

const refreshTokenController = crudController.create<RefreshToken>(refreshToken, true);

export async function logout(req: Request, res: Response) {
  const refreshToken = req.body.refreshToken;
  const memberCookie: MemberCookie = req.body.member;
  debugLog("logout:called with refreshToken:", refreshToken, "for memberCookie:", memberCookie);
  refreshTokenController.deleteDocument({body: {refreshToken}})
    .then(async deletionResponse => {
      if (deletionResponse.deleted) {
        const loginResponse = {alertMessage: `The member ${memberCookie.userName} logged out successfully`};
        await common.auditMemberLogin(memberCookie.userName, loginResponse, memberCookie);
        debugLog("logout:completed successfully with deletionResponse:", deletionResponse);
        res.status(200).json({loginResponse});
      } else {
        debugLog("logout:completed unsuccessfully with deletionResponse:", deletionResponse);
        res.status(200).end();
      }
    })
    .catch(error => {
      debugLog("logout:completed unsuccessfully with error:", error);
      const loginResponse = {
        alertMessage: `The member ${memberCookie.userName} logged out with unexpected error`,
        error
      };
      res.status(200).json({loginResponse});
    });
}

export async function refresh(req: Request, res: Response) {
  const existingRefreshToken: RefreshToken = req.body.refreshToken;
  debugLog("refresh:refreshToken:", existingRefreshToken);
  refreshToken.findOne({refreshToken: existingRefreshToken})
    .then((existingToken: any) => {
      debugLog("refresh:refreshToken is in refreshToken");
      const memberPayload = existingToken.memberPayload;
      const token = authConfig.signValue(memberPayload, authConfig.tokenExpiry.refresh);
      res.json({auth: token})
    })
    .catch(err => {
      debugLog("refresh returning 401: refreshToken, not found");
      res.sendStatus(401);
    });
}
