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
