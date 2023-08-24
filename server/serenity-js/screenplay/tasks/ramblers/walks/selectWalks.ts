import { RamblersWalkSummary } from "../../../../models/ramblersWalkSummary";
import { DeselectAllWalks } from "./deselectAllWalks";
import { SelectAllWalks } from "./selectAllWalks";
import { SelectWalksNotPublishedCancelledOrWithIds } from "./selectWalksNotPublishedCancelledOrWithIds";
import { SelectWalksWithIds } from "./selectWalksWithIds";
import { SelectWalksWithStatus } from "./selectWalksWithStatus";

export const WalkFilters = {
  withStatus: (walk: RamblersWalkSummary, ...statuses: string[]) => statuses.includes(walk.status),
  withIds: (walk: RamblersWalkSummary, ...walkIds: string[]) => walkIds.includes(walk.walkId),
  currentlySelected: (walk: RamblersWalkSummary) => walk.currentlySelected,
};

export class SelectWalks {

  static notPublishedOrWithIds(walkIds: string[]) {
    return new SelectWalksNotPublishedCancelledOrWithIds(walkIds);
  }

  static withIds(...walkIds: string[]) {
    return new SelectWalksWithIds(walkIds);
  }

  static withStatus(...statuses: string[]) {
    return new SelectWalksWithStatus(statuses);
  }

  static all() {
    return new SelectAllWalks();
  }

  static none() {
    return new DeselectAllWalks();
  }
}

