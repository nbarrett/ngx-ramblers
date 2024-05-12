import debug from "debug";
import { Member } from "../../../../projects/ngx-ramblers/src/app/models/member.model";
import * as stringUtils from "../../shared/string-utils";

import { envConfig } from "../../env-config/env-config";

const debugLog = debug(envConfig.logNamespace("member-common"));
debugLog.enabled = true;

export function resetUpdateStatusForMember(member: Member): Member {
  // updated == false means not up to date with mail e.g. next list update will send this data to mailchimo
  member.mailchimpLists.walks.updated = false;
  member.mailchimpLists.socialEvents.updated = false;
  member.mailchimpLists.general.updated = false;
  return member;
}

export function setPasswordResetId(member: Member): Member {
  member.passwordResetId = stringUtils.generateUid();
  debugLog("member.userName", member.userName, "member.passwordResetId", member.passwordResetId);
  return member;
}
