export interface WalkCancellation {
  walkId: string;
  reason: string;
}

export interface WalkUploadInfo {
  walkId: string;
  date: string;
  title: string;
}

export interface WalkUploadMetadata {
  fileName: string;
  walkCount: number;
  ramblersUser: string;
  walkDeletions: string[];
  walkCancellations: WalkCancellation[];
  walkUncancellations: string[];
  walkUploads: WalkUploadInfo[];
}
