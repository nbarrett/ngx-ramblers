export interface WalkCancellation {
  walkId: string;
  reason: string;
}

export interface WalkUploadMetadata {
  fileName: string;
  walkCount: number;
  ramblersUser: string;
  walkDeletions: string[];
  walkCancellations: WalkCancellation[];
  walkUncancellations: string[];
}
