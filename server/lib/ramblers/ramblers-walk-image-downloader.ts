import { promises as fs } from "node:fs";
import path from "node:path";
import { WalkImagesUpload as WalkImagesUploadSource } from "../../../projects/ngx-ramblers/src/app/models/ramblers-walks-manager";
import { WalkImagesUpload } from "../models/walk-upload-metadata";

export async function downloadWalkImages(uploads: WalkImagesUploadSource[], directory: string): Promise<WalkImagesUpload[]> {
  await fs.mkdir(directory, { recursive: true });

  return Promise.all(uploads.map(async (upload, walkIndex) => {
    const walkDirectory = path.join(directory, `walk-${walkIndex + 1}`);
    await fs.mkdir(walkDirectory, { recursive: true });
    const fileNames = uniqueFileNames(upload.images.map(image => image.fileName));
    return {
      date: upload.date,
      images: await Promise.all(upload.images.map(async (image, imageIndex) => ({
        alternativeText: image.alternativeText,
        fileName: fileNames[imageIndex],
        filePath: await downloadWalkImage(image.sourceUrl, fileNames[imageIndex], walkDirectory)
      }))),
      title: upload.title,
      walkId: upload.walkId,
      fieldChanges: upload.fieldChanges || []
    };
  }));
}

export function uniqueFileNames(fileNames: string[]): string[] {
  return fileNames.reduce((uniqueNames: string[], fileName: string) => {
    const sanitised = sanitisedFileName(fileName);
    const extension = path.extname(sanitised);
    const stem = sanitised.replace(extension, "");
    const duplicates = uniqueNames.filter(existing => existing === sanitised || existing.startsWith(`${stem}-`)).length;
    return uniqueNames.concat(duplicates === 0 ? sanitised : `${stem}-${duplicates + 1}${extension}`);
  }, []);
}

function sanitisedFileName(fileName: string): string {
  const extension = (path.extname(fileName || "").replace(/[^.a-zA-Z0-9]/g, "") || ".jpeg").toLowerCase();
  const stem = path.basename(fileName || "", path.extname(fileName || ""))
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `${stem || "walk-image"}${extension}`;
}

async function downloadWalkImage(sourceUrl: string, fileName: string, directory: string): Promise<string> {
  const response = await fetch(sourceUrl);

  if (!response.ok) {
    throw new Error(`Failed to download walk image ${sourceUrl}: ${response.status} ${response.statusText}`);
  }

  const localPath = path.join(directory, fileName);
  await fs.writeFile(localPath, new Uint8Array(await response.arrayBuffer()));
  return localPath;
}
