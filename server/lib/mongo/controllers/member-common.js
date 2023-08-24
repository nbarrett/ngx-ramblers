const {envConfig} = require("../../env-config/env-config");
const stringUtils = require("../../shared/string-utils");
const debug = require("debug")(envConfig.logNamespace("member-common"));

exports.resetUpdateStatusForMember = (member) => {
  // updated == false means not up to date with mail e.g. next list update will send this data to mailchimo
  member.mailchimpLists.walks.updated = false;
  member.mailchimpLists.socialEvents.updated = false;
  member.mailchimpLists.general.updated = false;
  return member;
}

exports.setPasswordResetId = (member) => {
  member.passwordResetId = stringUtils.generateUid();
  debug("member.userName", member.userName, "member.passwordResetId", member.passwordResetId);
  return member;
}
