import { EventType } from "./walk.model";

export interface WalkEventType {
  eventType: EventType;
  mustHaveLeader?: boolean;
  mustPassValidation?: boolean;
  showDetails?: boolean;
  readyToBe?: string;
  statusChange?: boolean;
  description: string;
  notifyLeader?: boolean;
  notifyCoordinator?: boolean;
}

export interface WalkEventNotificationMapping {
  eventType: EventType;
  notifyLeader?: object;
  notifyCoordinator?: object;
}
