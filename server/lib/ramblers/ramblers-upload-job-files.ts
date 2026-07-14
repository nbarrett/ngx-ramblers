import fs from "fs";
import { stringify } from "csv-stringify/sync";
import { RamblersUploadJob } from "../../../projects/ngx-ramblers/src/app/models/ramblers-upload-job.model";
import { WalkUploadMetadata } from "../models/walk-upload-metadata";
import path from "node:path";
import { downloadWalkImages } from "./ramblers-walk-image-downloader";

const ramblersUploadPath = "/tmp/ramblers";

export interface RamblersUploadPreparedFiles {
  csvData: string;
  filePath: string;
  metadata: WalkUploadMetadata;
  metadataPath: string;
  jobPath: string;
}

export async function prepareRamblersUploadJobFiles(job: RamblersUploadJob): Promise<RamblersUploadPreparedFiles> {
  const csvData = stringify(job.data.rows, { header: true, columns: job.data.headings });
  const jobPath = path.join(ramblersUploadPath, job.jobId);
  const filePath = path.join(jobPath, job.data.fileName);
  const metadataPath = path.join(jobPath, job.data.fileName.replace(".csv", "-metadata.json"));

  fs.mkdirSync(jobPath, { recursive: true });
  const walkImageUploads = await downloadWalkImages(job.data.walkImageUploads || [], path.join(jobPath, "images"));

  const metadata: WalkUploadMetadata = {
    fileName: filePath,
    walkCount: job.data.rows.length,
    ramblersUser: job.data.ramblersUser,
    walkDeletions: job.data.walkIdDeletionList,
    walkUploads: job.data.walkIdUploadList || [],
    walkImageUploads,
    walkCancellations: job.data.walkCancellations,
    walkUncancellations: job.data.walkUncancellations || []
  };

  fs.writeFileSync(filePath, csvData);
  fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));

  return {
    csvData,
    filePath,
    metadata,
    metadataPath,
    jobPath
  };
}

export function removeRamblersUploadJobFiles(jobPath: string): void {
  fs.rmSync(jobPath, { recursive: true, force: true });
}
