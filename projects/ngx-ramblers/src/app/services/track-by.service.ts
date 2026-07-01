import { Injectable } from "@angular/core";
import { DisplayedWalk } from "../models/walk.model";
import { ExtendedGroupEvent } from "../models/group-event.model";

@Injectable({
  providedIn: "root"
})
export class TrackByService {

  displayedWalk(index: number, displayedWalk: DisplayedWalk): string {
    return displayedWalk?.walk?.id
      || displayedWalk?.walk?.groupEvent?.id
      || displayedWalk?.walk?.groupEvent?.url
      || `fallback-${index}`;
  }

  extendedGroupEvent(index: number, event: ExtendedGroupEvent): string {
    return event?.id
      || event?.groupEvent?.id
      || event?.groupEvent?.url
      || `fallback-${index}`;
  }

  byId<T extends { id?: string }>(index: number, item: T): string {
    return item?.id || `fallback-${index}`;
  }

  byIndex(index: number): number {
    return index;
  }
}