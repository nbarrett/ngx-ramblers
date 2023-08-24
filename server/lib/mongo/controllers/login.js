const {envConfig} = require("../../env-config/env-config");
const authConfig = require("../../auth/auth-config");
const debug = require("debug")(envConfig.logNamespace("database:login"));
const auth = require("../models/auth");
const authCommon = require("./auth-common");

exports.login = (req, res) => {
  const userName = req.body.userName;
  debug("attempting to login userName:", userName);
  auth.findOne({userName: userName})
    .then(member => {
      if (member) {
        debug("findOne - member:password", member.password, "member.groupMember:", member.groupMember, "member.expiredPassword:", member.expiredPassword);
        const memberPayload = authCommon.toMemberPayload(member);
        const clearTextPasswordMatches = req.body.password === member.password;
        if (clearTextPasswordMatches) {
          debug("findOne - clearTextPasswordMatches:", clearTextPasswordMatches);
          authCommon.returnResponse({res: res, memberPayload: memberPayload, member: member});
        } else {
          authConfig.compareValue(req.body.password, member.password).then((success) => {
            debug("bcryptComparisonSuccess:", success);
            if (success) {
              authCommon.returnResponse({res: res, memberPayload: memberPayload, member: member});
            } else {
              authCommon.returnAuthFailure({res: res, message: "incorrect password", userName});
            }
          });
        }
      } else {
        authCommon.returnAuthFailure({
          res: res,
          message: "incorrect user name or password supplied",
          userName
        });
      }
    })
    .catch(error => {
      if (error) {
        authCommon.returnAuthFailure({res: res, message: "an unexpected error - " + error, status: 500});
      } else {
        authCommon.returnAuthFailure({res: res, message: "Your member credentials were not entered correctly"});
      }
    });
}
