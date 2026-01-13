import { ChangedItemDisplay } from "./changed-item.model";

export interface DisplayedEvent {
  id: string;
  member: string;
  date: string;
  eventType: string;
  changes: ChangedItemDisplay[];
  notes?: string;
  data?: object;
}
