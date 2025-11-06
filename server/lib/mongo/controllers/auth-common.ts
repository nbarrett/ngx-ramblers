import debug from "debug";
import * as authConfig from "../../auth/auth-config";
import { envConfig } from "../../env-config/env-config";
import { refreshToken } from "../models/refresh-token";
import { memberAudit } from "../models/member-audit";
import {
  LoginResponse,
  Member,
  MemberAuthAudit,
  MemberCookie
} from "../../../../projects/ngx-ramblers/src/app/models/member.model";
import { AuthResponse } from "../../../../projects/ngx-ramblers/src/app/models/auth-data.model";
import { Response } from "express";
import * as transforms from "./transforms";
import { dateTimeNowAsValue } from "../../shared/dates";
import * as crudController from "./crud-controller";
import { member } from "../models/member";

const debugLog = debug(envConfig.logNamespace("database:auth:common"));
export const pleaseTryAgain = `. Please try again or`;
export const please = `. Please`;
debugLog.enabled = false;
const controller = crudController.create<Member>(member);

export interface ReturnTokenOnSuccessParams {
  status?: number;
  res: Response;
  loginResponse?: LoginResponse;
  memberCookie: MemberCookie;
  member: Member;
}

export function returnResponse(options: ReturnTokenOnSuccessParams) {
  try {
    options.loginResponse = this.determineLoginSuccessAndAudit(options.memberCookie, options.member);
    this.returnTokenOnSuccess(options);
  } catch (e) {
    controller.errorDebugLog("returnResponse:catch:options", options, "error:", e);
  }
}

export function determineLoginSuccessAndAudit(memberCookie: MemberCookie, member: Member) {
  const userName = memberCookie.userName;
  const loginResponse: LoginResponse = {userName};
  debugLog("determineLoginSuccessAndAudit:member", memberCookie.userName);
  if (!member.groupMember) {
    loginResponse.alertMessage = `Logins for member ${userName} have been disabled${this.please}`;
  } else if (member.expiredPassword) {
    loginResponse.showResetPassword = true;
    loginResponse.alertMessage = `The password for ${userName} has expired. You must enter a new password before continuing. Alternatively`;
  } else {
    loginResponse.memberLoggedIn = true;
    loginResponse.alertMessage = `The member ${userName} logged in successfully`;
  }
  this.auditMemberLogin(userName, loginResponse, member);
  return loginResponse;
}

export function returnTokenOnSuccess(options: ReturnTokenOnSuccessParams) {
  try {
    const response: AuthResponse = {tokens: {auth: null, refresh: null}, loginResponse: options.loginResponse};
    options.status = response.loginResponse.memberLoggedIn || response.loginResponse.showResetPassword ? 200 : 401;
    if (response.loginResponse.memberLoggedIn) {
      const refreshTokenValue = authConfig.randomToken();
      debugLog("creating new refreshToken:", refreshTokenValue, "for memberPayload:", options.memberCookie);
      return new refreshToken({
        refreshToken: refreshTokenValue,
        memberPayload: options.memberCookie
      })
        .save()
        .then((result: any) => {
          debugLog("created new refreshToken document:", result);
          response.tokens = {
            auth: authConfig.signValue(options.memberCookie, authConfig.tokenExpiry.auth),
            refresh: refreshTokenValue
          };
          debugLog("issuing tokens:", {
            refresh: response.tokens.refresh,
            authExpiresInSeconds: authConfig.tokenExpiry.auth
          });
          options.res.status(options.status).json(response);
        })
        .catch(error => {
          options.status = 500;
          response.loginResponse.memberLoggedIn = false;
          response.error = error;
          options.res.status(options.status).json(response);
        });
    } else {
      options.res.status(options.status).json(response);
    }
    debugLog("returning", response, "with status", options.status);
  } catch (error) {
    controller.errorDebugLog("returnTokenOnSuccess:catch", error);
  }
}

export function auditMemberLogin(userName: string, loginResponse: LoginResponse, member: Member): Promise<MemberAuthAudit> {
  try {
    debugLog("auditMemberLogin:userName", userName);
    return new memberAudit({
      userName,
      loginTime: dateTimeNowAsValue(),
      loginResponse,
      member: isMemberCookie(member) ? member : member ? toMemberCookie(member) : member
    }).save()
      .then(result => {
        const memberAuthAudit = transforms.toObjectWithId(result);
        debugLog("result:", result, "memberAuthAudit:", memberAuthAudit);
        return memberAuthAudit;
      })
      .catch(error => {
        controller.errorDebugLog("auditMemberLogin:save:error", error);
        return Promise.resolve(null as any);
      });
  } catch (e) {
    controller.errorDebugLog("auditMemberLogin:for audit of user", userName, "error:", e);
    return Promise.reject(e);
  }
}

export function returnAuthFailure(options) {
  const loginResponse = {
    alertMessage: `Authentication failed due to ${options.message}${pleaseTryAgain}`,
    userName: options.userName
  };
  this.auditMemberLogin(options.userName, loginResponse, options.member)
  options.res.status(options.status | 401).json({loginResponse});
}

export function returnError(options) {
  options.res.status(500).json({message: "Unexpected error", error: options.error.toString()});
}

export function toMemberCookie(member: Member): MemberCookie {
  if (!member?.id) {
    throw new Error("toMemberCookie:member must have an id but member provided only contained:" + JSON.stringify(member));
  }
  const memberCookie = {
    memberId: member?.id,
    walkAdmin: member?.walkAdmin,
    socialAdmin: member?.socialAdmin,
    socialMember: member?.socialMember,
    contentAdmin: member?.contentAdmin,
    memberAdmin: member?.memberAdmin,
    financeAdmin: member?.financeAdmin,
    committee: member?.committee,
    treasuryAdmin: member?.treasuryAdmin,
    fileAdmin: member?.fileAdmin,
    firstName: member?.firstName,
    lastName: member?.lastName,
    postcode: member?.postcode,
    userName: member?.userName,
    profileSettingsConfirmed: member?.profileSettingsConfirmed
  };
  debugLog("toMemberCookie:member cookie: ", memberCookie);
  return memberCookie;
}

export function isMemberCookie(object: any): object is MemberCookie {
  const request = object as MemberCookie;
  return request?.memberId !== undefined;
}
