import { WalkCancellation, WalkImagesUpload, WalkUploadInfo } from "../../models/walk-upload-metadata";

export interface WalkRequestParameters {
  fileName: string;
  ramblersUser: string;
  walkDeletions: string[];
  walkCancellations: WalkCancellation[];
  walkUncancellations: string[];
  walkCount: number;
  walkUploads: WalkUploadInfo[];
  walkImageUploads: WalkImagesUpload[];
}
