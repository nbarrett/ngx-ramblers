import { Injectable } from "@angular/core";
import { DisplayedWalk } from "../models/walk.model";
import { ExtendedGroupEvent } from "../models/group-event.model";

@Injectable({
  providedIn: "root"
})
export class TrackByService {

  /**
   * TrackBy function for DisplayedWalk objects.
   * Uses the most unique identifier available, falling back to index only as last resort.
   */
  displayedWalk(index: number, displayedWalk: DisplayedWalk): string {
    return displayedWalk?.walk?.id
      || displayedWalk?.walk?.groupEvent?.id
      || displayedWalk?.walk?.groupEvent?.url
      || `fallback-${index}`;
  }

  /**
   * TrackBy function for ExtendedGroupEvent objects.
   */
  extendedGroupEvent(index: number, event: ExtendedGroupEvent): string {
    return event?.id
      || event?.groupEvent?.id
      || event?.groupEvent?.url
      || `fallback-${index}`;
  }

  /**
   * Generic trackBy function for objects with id property.
   */
  byId<T extends { id?: string }>(index: number, item: T): string {
    return item?.id || `fallback-${index}`;
  }

  /**
   * TrackBy function for simple arrays by index.
   */
  byIndex(index: number): number {
    return index;
  }
}