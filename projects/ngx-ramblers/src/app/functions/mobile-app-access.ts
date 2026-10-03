import { MemberCookie } from "../models/member.model";
import { AccessLevel } from "../models/member-resource.model";
import { DEFAULT_MOBILE_APP_CONFIG, MobileAppAction, WalksConfig } from "../models/walks-config.model";
import { eventAccessPermitted } from "./event-access-level";

export function mobileAppAccessPermitted(config: WalksConfig | null, action: MobileAppAction, member: Partial<MemberCookie> | null): boolean {
  const settings = {...DEFAULT_MOBILE_APP_CONFIG, ...config?.mobileApp};
  const context = {loggedIn: !!member?.memberId, committee: !!member?.committee,
    memberAdmin: !!member?.memberAdmin, eventAdmin: !!member?.walkAdmin, eventLeader: false};
  const access = eventAccessPermitted(settings.access, context);
  const actionPermitted = eventAccessPermitted(settings[action], context);
  const requiresMember = action === MobileAppAction.RECORD || action === MobileAppAction.IMPORT || action === MobileAppAction.EDIT;
  return access && actionPermitted && (!requiresMember || context.loggedIn)
    && settings[action] !== AccessLevel.HIDDEN;
}
