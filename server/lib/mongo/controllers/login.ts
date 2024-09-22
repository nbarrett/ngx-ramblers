import { auth } from "../models/auth";
import * as authCommon from "./auth-common";
import debug from "debug";
import { envConfig } from "../../env-config/env-config";
import * as authConfig from "../../auth/auth-config";
import { Member } from "../../../../projects/ngx-ramblers/src/app/models/member.model";
import * as transforms from "./transforms";
import { Request, Response } from "express";

const debugLog = debug(envConfig.logNamespace("database:login"));
debugLog.enabled = false;
const authenticationFailureMessage = "incorrect username and password combination";

export function login(req: Request, res: Response) {
  const userName = req.body.userName;
  debugLog("attempting to login userName:", userName);
  auth.findOne({userName})
    .then((document: any) => {
      const member: Member = transforms.toObjectWithId(document);
      if (member) {
        debugLog("findOne - succeeded:member:", member);
        debugLog("findOne - member:password", member.password, "member.groupMember:", member.groupMember, "member.expiredPassword:", member.expiredPassword);
        const memberCookie = authCommon.toMemberCookie(member);
        const clearTextPasswordMatches = req.body.password === member.password;
        if (clearTextPasswordMatches) {
          debugLog("findOne - clearTextPasswordMatches:", clearTextPasswordMatches);
          authCommon.returnResponse({res, member, memberCookie});
        } else {
          authConfig.compareValue(req.body.password, member.password).then(success => {
            debugLog("bcryptComparisonSuccess:", success);
            if (success) {
              authCommon.returnResponse({res, memberCookie, member});
            } else {
              authCommon.returnAuthFailure({res, message: authenticationFailureMessage, userName});
            }
          });
        }
      } else {
        authCommon.returnAuthFailure({
          res,
          message: authenticationFailureMessage,
          userName
        });
      }
    })
    .catch(error => {
      if (error) {
        authCommon.returnAuthFailure({res, message: "an unexpected error - " + error, status: 500});
      } else {
        authCommon.returnAuthFailure({res, message: "Your member credentials were not entered correctly"});
      }
    });
}
