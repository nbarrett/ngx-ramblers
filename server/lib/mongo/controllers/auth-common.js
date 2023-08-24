const moment = require("moment-timezone");
const authConfig = require("../../auth/auth-config");
const {envConfig} = require("../../env-config/env-config");
const refreshToken = require("../models/refresh-token");
const debug = require("debug")(envConfig.logNamespace("database:auth"));
const memberAudit = require("../models/member-audit");
const pleaseTryAgain = `. Please try again or`;
const please = `. Please`;

exports.pleaseTryAgain = pleaseTryAgain

exports.please = please

exports.returnResponse = options => {
  options.loginResponse = this.determineLoginSuccessAndAudit(options.memberPayload, {
    groupMember: options.member.groupMember,
    expiredPassword: options.member.expiredPassword
  })
  this.returnTokenOnSuccess(options);
};

exports.determineLoginSuccessAndAudit = (memberPayload, memberFlags) => {
  const userName = memberPayload.userName;
  const loginResponse = {userName};
  debug("determineLoginSuccessAndAudit:member", memberPayload.userName);
  if (!memberFlags.groupMember) {
    loginResponse.alertMessage = `Logins for member ${userName} have been disabled${this.please}`;
  } else if (memberFlags.expiredPassword) {
    loginResponse.showResetPassword = true;
    loginResponse.alertMessage = `The password for ${userName} has expired. You must enter a new password before continuing. Alternatively`;
  } else {
    loginResponse.memberLoggedIn = true;
    loginResponse.alertMessage = `The member ${userName} logged in successfully`;
  }
  this.auditMemberLogin(userName, loginResponse, memberPayload);
  return loginResponse;
}

exports.returnTokenOnSuccess = (options) => {
  const response = {loginResponse: options.loginResponse}
  options.status = response.loginResponse.memberLoggedIn || response.loginResponse.showResetPassword ? 200 : 401;
  if (response.loginResponse.memberLoggedIn) {
    const refreshTokenValue = authConfig.randomToken();
    debug("creating new refreshToken:", refreshTokenValue);
    new refreshToken({
      refreshToken: refreshTokenValue,
      memberPayload: options.memberPayload
    }).save()
      .then(result => {
        response.tokens = {
          auth: authConfig.signValue(options.memberPayload, authConfig.tokenExpiry.auth),
          refresh: refreshTokenValue
        }
        options.res.status(options.status).json(response);
      })
      .catch(error => {
        options.status = 500;
        response.loginResponse.memberLoggedIn = false;
        response.error = error;
        options.options.res.status(options.status).json(response);
      });
  } else {
    options.res.status(options.status).json(response);
  }
  debug("returning", response, "with status", options.status);
}

exports.auditMemberLogin = (userName, loginResponse, member) => {
  debug("auditMemberLogin:userName", userName);
  new memberAudit({
    userName,
    loginTime: moment().tz("Europe/London").valueOf(),
    loginResponse,
    member: member && exports.toMemberPayload(member)
  }).save()
    .then(result => {
      debug("audited:", userName);
    })
    .catch(err => {
      debug("failed to audit", userName, "due to", err);
    });
}

exports.returnAuthFailure = (options) => {
  const loginResponse = {
    alertMessage: `Authentication failed due to ${options.message}${pleaseTryAgain}`,
    userName: options.userName
  };
  this.auditMemberLogin(options.userName, loginResponse, options.member)
  options.res.status(options.status | 401).json({loginResponse: loginResponse});
};

exports.returnError = function (options) {
  options.res.status(500).json({message: "Unexpected error", error: options.error.toString()});
};

exports.toMemberPayload = (member) => {
  const memberPayload = {
    memberId: member._id || member.memberId,
    walkAdmin: member.walkAdmin,
    socialAdmin: member.socialAdmin,
    socialMember: member.socialMember,
    contentAdmin: member.contentAdmin,
    memberAdmin: member.memberAdmin,
    financeAdmin: member.financeAdmin,
    committee: member.committee,
    treasuryAdmin: member.treasuryAdmin,
    fileAdmin: member.fileAdmin,
    firstName: member.firstName,
    lastName: member.lastName,
    postcode: member.postcode,
    userName: member.userName,
    profileSettingsConfirmed: member.profileSettingsConfirmed
  };
  debug("memberPayload: ", memberPayload);
  return memberPayload;
}
