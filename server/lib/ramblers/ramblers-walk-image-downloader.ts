import { promises as fs } from "node:fs";
import path from "node:path";
import { WalkImagesUpload as WalkImagesUploadSource } from "../../../projects/ngx-ramblers/src/app/models/ramblers-walks-manager";
import { WalkImagesUpload } from "../models/walk-upload-metadata";

export async function downloadWalkImages(uploads: WalkImagesUploadSource[], directory: string): Promise<WalkImagesUpload[]> {
  await fs.mkdir(directory, { recursive: true });

  return Promise.all(uploads.map(async (upload, walkIndex) => ({
    date: upload.date,
    images: await Promise.all(upload.images.map(async (image, imageIndex) => ({
      alternativeText: image.alternativeText,
      filePath: await downloadWalkImage(image.sourceUrl, image.fileName, directory, walkIndex, imageIndex)
    }))),
    title: upload.title,
    walkId: upload.walkId
  })));
}

async function downloadWalkImage(sourceUrl: string, fileName: string, directory: string, walkIndex: number, imageIndex: number): Promise<string> {
  const response = await fetch(sourceUrl);

  if (!response.ok) {
    throw new Error(`Failed to download walk image ${sourceUrl}: ${response.status} ${response.statusText}`);
  }

  const extension = path.extname(fileName).replace(/[^.a-zA-Z0-9]/g, "") || ".jpeg";
  const localPath = path.join(directory, `${walkIndex + 1}-${imageIndex + 1}${extension}`);
  await fs.writeFile(localPath, new Uint8Array(await response.arrayBuffer()));
  return localPath;
}
