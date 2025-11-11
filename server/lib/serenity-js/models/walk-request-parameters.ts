import { WalkCancellation } from "../../models/walk-upload-metadata";

export interface WalkRequestParameters {
  fileName: string;
  walkDeletions: string[];
  walkCancellations: WalkCancellation[];
  walkUncancellations: string[];
  walkCount: number;
}
