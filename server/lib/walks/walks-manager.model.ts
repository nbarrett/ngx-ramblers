import { DateTime } from "luxon";
import { Model } from "mongoose";
import { ExtendedGroupEvent } from "../../../projects/ngx-ramblers/src/app/models/group-event.model";
import { Member } from "../../../projects/ngx-ramblers/src/app/models/member.model";
import { ConfigDocument } from "../../../projects/ngx-ramblers/src/app/models/config.model";

export enum CacheActionType {
  Added = "added",
  Updated = "updated",
  None = "none",
}

export interface CacheStats {
  added: number;
  updated: number;
}

export interface DuplicateDetail {
  groupEventId: string;
  keptDocId: string;
  deletedDocIds: string[];
}

export interface CleanupStats {
  duplicatesRemoved: number;
  ramblersIdsProcessed: number;
  details: DuplicateDetail[];
}

export interface WalksManagerSyncModels {
  extendedGroupEvent: Model<ExtendedGroupEvent>;
  member: Model<Member>;
  config: Model<ConfigDocument>;
}

export interface SyncOptions {
  fullSync?: boolean;
  dateFrom?: DateTime;
  dateTo?: DateTime;
  onProgress?: (percent: number, message: string) => void;
}

export interface SyncResult {
  added: number;
  updated: number;
  deleted: number;
  errors: string[];
  lastSyncedAt: number;
  totalProcessed: number;
}
