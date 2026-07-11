import { ExtendedGroupEvent } from "../../models/group-event.model";

export function eventSlug(event: ExtendedGroupEvent): string {
  const identifier = event?.groupEvent?.url || event?.groupEvent?.id || event?.id;
  return identifier?.split("/").filter(segment => segment).pop();
}
