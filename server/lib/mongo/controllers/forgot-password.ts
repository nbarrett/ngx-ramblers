import * as authCommon from "./auth-common";
import debug from "debug";
import { Request, Response } from "express";
import { envConfig } from "../../env-config/env-config";
import { member } from "../models/member";
import * as  transforms from "./transforms";
import { LoginResponse, Member } from "../../../../projects/ngx-ramblers/src/app/models/member.model";
import * as stringUtils from "../../shared/string-utils";

const debugLog = debug(envConfig.logNamespace("database:forgot-password"));
debugLog.enabled = true;

export async function forgotPassword(req: Request, res: Response) {
  try {
    if (req.body.credentialOne && req.body.credentialTwo) {
      const credentialOne = req.body.credentialOne.toLowerCase().trim();
      const credentialTwo = req.body.credentialTwo.toUpperCase().trim();
      const userDetails = req.body.userDetails;
      const criteria = {
        $and: [
          {$or: [{userName: {$eq: credentialOne}}, {email: {$eq: credentialOne}}]},
          {$or: [{membershipNumber: {$eq: credentialTwo}}, {postcode: {$eq: credentialTwo}}]}]
      };
      const fields = {
        groupMember: 1,
        firstName: 1,
        lastName: 1,
        membershipNumber: 1,
        email: 1,
        userName: 1,
        membershipExpiryDate: 1,
        passwordResetId: 1,
        mailchimpLists: 1
      };

      const loginResponse: LoginResponse = {};
      const returnNotFound = () => {
        loginResponse.alertMessage = `No member was found with ${userDetails}. Please try again or`;
        res.status(401).json({loginResponse});
      };
      member.findOne(criteria, fields)
        .then((member: any) => {
          debugLog("found member", member);
          if (!member) {
            returnNotFound();
          } else if (!member.email) {
            loginResponse.alertMessage = `Sorry, you are not setup in our system to receive emails so we can't send you password reset instructions${authCommon.please}`;
            res.status(200).json({loginResponse});
          } else {
            loginResponse.alertMessage = "New password requested from login screen";
            member.passwordResetId = stringUtils.generateUid();
            debugLog("about to save member with passwordResetId set:", member);
            member.save()
              .then(async (document: Document) => {
                debugLog("member save response with document:", document);
                const updatedMember: Member = transforms.toObjectWithId(document);
                debugLog("updatedMember member:", updatedMember);
                const memberCookie = authCommon.toMemberCookie(updatedMember);
                debugLog("memberCookie:", memberCookie);
                loginResponse.member = updatedMember;
                await authCommon.auditMemberLogin(memberCookie.userName, loginResponse, updatedMember);
                res.status(200).json({loginResponse});
              });
            loginResponse.alertMessage = `${userDetails} search successful`;
          }
        }).catch(error => {
        debugLog("error:", error);
        if (!error) {
          returnNotFound();
        } else {
          authCommon.returnError({res, error});
        }
      });
    } else {
      res.status(400).json({message: "Message body must contain credentialOne and credentialTwo"});
    }
  } catch (error) {
    authCommon.returnError({res, error});
  }
}
