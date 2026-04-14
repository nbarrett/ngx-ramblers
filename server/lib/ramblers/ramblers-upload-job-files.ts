import fs from "fs";
import { stringify } from "csv-stringify/sync";
import { RamblersUploadJob } from "../../../projects/ngx-ramblers/src/app/models/ramblers-upload-job.model";
import { WalkUploadMetadata } from "../models/walk-upload-metadata";

const ramblersUploadPath = "/tmp/ramblers/";

export interface RamblersUploadPreparedFiles {
  csvData: string;
  filePath: string;
  metadata: WalkUploadMetadata;
  metadataPath: string;
}

export function prepareRamblersUploadJobFiles(job: RamblersUploadJob): RamblersUploadPreparedFiles {
  const csvData = stringify(job.data.rows, { header: true, columns: job.data.headings });
  const filePath = ramblersUploadPath + job.data.fileName;
  const metadataPath = ramblersUploadPath + job.data.fileName.replace(".csv", "-metadata.json");

  if (!fs.existsSync(ramblersUploadPath)) {
    fs.mkdirSync(ramblersUploadPath, { recursive: true });
  }

  const metadata: WalkUploadMetadata = {
    fileName: filePath,
    walkCount: job.data.rows.length,
    ramblersUser: job.data.ramblersUser,
    walkDeletions: job.data.walkIdDeletionList,
    walkUploads: job.data.walkIdUploadList || [],
    walkCancellations: job.data.walkCancellations,
    walkUncancellations: job.data.walkUncancellations || []
  };

  fs.writeFileSync(filePath, csvData);
  fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));

  return {
    csvData,
    filePath,
    metadata,
    metadataPath
  };
}
