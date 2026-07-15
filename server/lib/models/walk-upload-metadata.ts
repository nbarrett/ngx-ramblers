import { WalkFieldChange } from "../../../projects/ngx-ramblers/src/app/models/ramblers-walks-manager";

export interface WalkCancellation {
  walkId: string;
  reason: string;
}

export interface WalkUploadInfo {
  walkId: string;
  date: string;
  title: string;
}

export interface WalkImageUpload {
  alternativeText: string;
  fileName: string;
  filePath: string;
}

export interface ExistingWalkImage {
  fileName: string;
  alternativeText: string;
}

export interface WalkImageDelta {
  fullReplace: boolean;
  removalIndexes: number[];
  additions: WalkImageUpload[];
  unchanged: number;
  alternativeTextUpdates: number;
  reorderRequired: boolean;
}

export interface WalkImagesUpload {
  date: string;
  images: WalkImageUpload[];
  walkId: string | null;
  title: string;
  fieldChanges: WalkFieldChange[];
  imagesChanged: boolean;
}

export interface WalkUploadMetadata {
  fileName: string;
  walkCount: number;
  ramblersUser: string;
  walkDeletions: string[];
  walkCancellations: WalkCancellation[];
  walkUncancellations: string[];
  walkUploads: WalkUploadInfo[];
  walkImageUploads: WalkImagesUpload[];
}
