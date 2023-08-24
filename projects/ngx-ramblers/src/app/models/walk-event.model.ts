import { EventType } from "./walk.model";

export interface WalkEvent {
  data: object;
  eventType: EventType;
  date: number;
  memberId: string;
  notes?: string;
  description?: string;
  reason?: string;
}

