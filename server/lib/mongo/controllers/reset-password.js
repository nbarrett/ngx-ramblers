const auth = require("../models/auth");
const authConfig = require("../../auth/auth-config");
const authCommon = require("./auth-common");
const {envConfig} = require("../../env-config/env-config");
const debug = require("debug")(envConfig.logNamespace("database:reset-password"));

exports.resetPassword = (req, res) => {
  const userName = req.body.userName;
  const newPassword = req.body.newPassword;
  const newPasswordConfirm = req.body.newPasswordConfirm;
  debug("resetPassword.req.body:", req.body);
  const loginResponse = {showResetPassword: true};
  auth.findOne({userName: userName})
    .then(member => {
      debug("resetPassword.found:", member.userName);
      if (!newPassword || newPassword.length < 6) {
        loginResponse.alertMessage = "The new password needs to be at least 6 characters long. Please try again or";
        authCommon.auditMemberLogin(member.userName, loginResponse, member);
        res.status(200).json({loginResponse: loginResponse});
      } else if (newPassword !== newPasswordConfirm) {
        loginResponse.alertMessage = `The new password was not confirmed correctly for ${member.userName}. Please try again or`;
        authCommon.auditMemberLogin(member.userName, loginResponse, member);
        res.status(200).json({loginResponse: loginResponse});
      } else {
        loginResponse.showResetPassword = false;
        debug(`Saving new password for ${member.userName} and removing expired status`);
        member.expiredPassword = undefined;
        member.passwordResetId = undefined;
        authConfig.hashValue(newPassword).then(hash => {
          member.password = hash;
          debug("saveNewPassword.loginResponse:", loginResponse, "password:", newPassword, "-> hash:", member.password);
          member.save()
            .then(updatedMember => {
              debug("updated member following password-reset:", updatedMember);
              const memberPayload = authCommon.toMemberPayload(updatedMember);
              loginResponse.alertMessage = `The password for ${memberPayload.userName} was changed successfully`;
              loginResponse.memberLoggedIn = true;
              authCommon.auditMemberLogin(memberPayload.userName, loginResponse, memberPayload)
              authCommon.returnTokenOnSuccess({res: res, loginResponse: loginResponse, memberPayload: memberPayload});
            })
            .catch(err => {
              if (err) {
                authCommon.returnAuthFailure({res: res, message: "an unexpected error - " + err});
              } else {
                authCommon.returnAuthFailure({res: res, message: "an unexpected error"});
              }
            });
        })
      }
    })
    .catch(err => {
      if (err) {
        authCommon.returnAuthFailure({res: res, message: "an unexpected error - " + err});
      } else {
        authCommon.returnAuthFailure({res: res, message: "Your member credentials were not entered correctly"});
      }
    });
}
