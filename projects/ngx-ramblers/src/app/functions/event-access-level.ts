import { AccessLevel, EventAccessContext } from "../models/member-resource.model";

export function eventAccessPermitted(accessLevel: AccessLevel | null | undefined, context: EventAccessContext): boolean {
  const level = accessLevel || AccessLevel.EVENT_ADMIN;
  if (level === AccessLevel.HIDDEN) {
    return false;
  } else if (level === AccessLevel.PUBLIC) {
    return true;
  } else if (level === AccessLevel.LOGGED_IN_MEMBER) {
    return context.loggedIn;
  } else if (level === AccessLevel.COMMITTEE) {
    return context.eventAdmin || context.committee;
  } else if (level === AccessLevel.EVENT_LEADER) {
    return context.eventAdmin || context.eventLeader;
  } else if (level === AccessLevel.MEMBER_ADMIN || level === AccessLevel.ENVIRONMENT_ADMIN) {
    return context.eventAdmin || context.memberAdmin;
  } else {
    return context.eventAdmin;
  }
}
