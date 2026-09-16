import { ServerFileNameData } from "../../../projects/ngx-ramblers/src/app/models/aws-object.model";

export interface GpxCoordinates {
  startLat: number;
  startLng: number;
}

export interface StoredGpxObject {
  awsFileName: string;
  lastModified?: number;
}

export interface GpxFileListItem {
  fileData: ServerFileNameData;
  startLat: number;
  startLng: number;
  name: string;
  walkTitle?: string;
  walkDate?: number;
  uploadDate?: number;
}
