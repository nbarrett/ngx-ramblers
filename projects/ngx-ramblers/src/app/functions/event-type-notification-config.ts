import { isString } from "es-toolkit/compat";
import { Organisation } from "../models/system.model";
import { RamblersEventType } from "../models/ramblers-walks-manager";

export function notificationConfigIdFieldFor(eventType: RamblersEventType | string | null | undefined): keyof Organisation {
  return eventType === RamblersEventType.GROUP_WALK ? "groupWalkNotificationConfigId" : "groupEventNotificationConfigId";
}

export function notificationConfigIdFor(group: Organisation | null | undefined, eventType: RamblersEventType | string | null | undefined): string | null {
  const configId = group?.[notificationConfigIdFieldFor(eventType)];
  return isString(configId) && configId.trim().length > 0 ? configId : null;
}
