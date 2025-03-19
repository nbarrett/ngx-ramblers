import { RamblersWalkSummary } from "../../../../models/ramblers-walk-summary";
import { DeselectAllWalks } from "./deselect-all-walks";
import { SelectAllWalks } from "./select-all-walks";
import { SelectWalksNotPublishedCancelledOrWithIds } from "./select-walks-not-published-cancelled-or-with-ids";
import { SelectWalksWithIds } from "./select-walks-with-ids";
import { SelectWalksWithStatus } from "./select-walks-with-status";
import { lastItemFrom, pluraliseWithCount } from "../../../../../shared/string-utils";
import debug from "debug";
import { envConfig } from "../../../../../env-config/env-config";

const debugLog = debug(envConfig.logNamespace("WalkFilters"));
debugLog.enabled = false;

export const WalkFilters = {
  withStatus: (walk: RamblersWalkSummary, ...statuses: string[]) => statuses.includes(walk.status),
  withIds: (walk: RamblersWalkSummary, ...walkIds: string[]) => {
    const walkIdPaths = walkIds.map(walkId => lastItemFrom(walkId));
    const walkIdPath = lastItemFrom(walk.walkId);
    const match = walkIdPaths.includes(walkIdPath);
    debugLog("Given walkId", walk.walkId, "mapped to", walkIdPath, "and",
      pluraliseWithCount(walkIds.length, "walk id"),
      walkIds.join(", "), "mapped to",
      pluraliseWithCount(walkIds.length, "walk id path"), walkIdPaths.join(", "),
      "match was:", match);
    return match;
  },
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
    return new SelectAllWalks("#actor selects all walks");
  }

  static none() {
    return new DeselectAllWalks("#actor deselects all walks");
  }
}

