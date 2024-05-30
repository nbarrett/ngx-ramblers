import debug from "debug";
import { Request, Response } from "express";
import { envConfig } from "../../env-config/env-config";
import { auth } from "../models/auth";
import * as transforms from "./transforms";
import * as authConfig from "../../auth/auth-config";
import * as authCommon from "./auth-common";
import { LoginResponse, Member, MemberCookie } from "../../../../projects/ngx-ramblers/src/app/models/member.model";
import { Document } from "mongoose";
import * as crudController from "./crud-controller";
import { member } from "../models/member";

const debugLog = debug(envConfig.logNamespace("database:reset-password"));
debugLog.enabled = true;
const controller = crudController.create<Member>(member, true);

export function resetPassword(req: Request, res: Response) {
  const userName = req.body.userName;
  const newPassword = req.body.newPassword;
  const newPasswordConfirm = req.body.newPasswordConfirm;
  debugLog("resetPassword.req.body:", req.body);
  const loginResponse: LoginResponse = {showResetPassword: true};
  auth.findOne({userName})
    .then((memberDocument: Document) => {
      const member: Member = transforms.toObjectWithId(memberDocument);
      debugLog("resetPassword.found:", member.userName);
      if (!newPassword || newPassword.length < 6) {
        loginResponse.alertMessage = "The new password needs to be at least 6 characters long. Please try again or";
        authCommon.auditMemberLogin(member.userName, loginResponse, member);
        res.status(200).json({loginResponse});
      } else if (newPassword !== newPasswordConfirm) {
        loginResponse.alertMessage = `The new password was not confirmed correctly for ${member.userName}. Please try again or`;
        authCommon.auditMemberLogin(member.userName, loginResponse, member);
        res.status(200).json({loginResponse});
      } else {
        loginResponse.showResetPassword = false;
        debugLog(`Saving new password for ${member.userName} and removing expired status`);
        member.expiredPassword = undefined;
        member.passwordResetId = undefined;
        authConfig.hashValue(newPassword).then(hash => {
          member.password = hash;
          debugLog("saveNewPassword.loginResponse:", loginResponse, "password:", newPassword, "-> hash:", member.password);
          controller.updateDocument({body: member})
            .then(member => {
              debugLog("updated member following password-reset:", member);
              const memberCookie: MemberCookie = authCommon.toMemberCookie(member);
              loginResponse.alertMessage = `The password for ${member.userName} was changed successfully`;
              loginResponse.memberLoggedIn = true;
              authCommon.auditMemberLogin(member.userName, loginResponse, member)
              authCommon.returnTokenOnSuccess({res, loginResponse, memberCookie, member});
            })
            .catch(err => {
              if (err) {
                authCommon.returnAuthFailure({res, message: "an unexpected error - " + err});
              } else {
                authCommon.returnAuthFailure({res, message: "an unexpected error"});
              }
            });
        })
      }
    })
    .catch(err => {
      if (err) {
        authCommon.returnAuthFailure({res, message: "an unexpected error - " + err});
      } else {
        authCommon.returnAuthFailure({res, message: "Your member credentials were not entered correctly"});
      }
    });
}
