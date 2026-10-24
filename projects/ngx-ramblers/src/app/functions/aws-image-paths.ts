import { values } from "es-toolkit/compat";
import { S3_BASE_URL } from "../models/content-metadata.model";
import { RootFolder } from "../models/system.model";

const AWS_IMAGE_PROXY_PATH = new RegExp(`^(?:https?:\\/\\/[^/]+)?\\/?${S3_BASE_URL}/(.+)$`, "i");

export function storedAwsImagePath(path: string): string {
  const match = (path || "").match(AWS_IMAGE_PROXY_PATH);
  return match ? match[1] : path;
}

export function awsImageResourcePath(path: string): string {
  const key = storedAwsImagePath(path);
  const storedImage = values(RootFolder).some(folder => key?.startsWith(`${folder}/`));
  const remote = /^[a-z][a-z0-9+.-]*:|^\/\//i.test(path || "");
  return storedImage && !remote ? `/${S3_BASE_URL}/${key}` : path;
}

function mapImagePaths(content: string, imagePath: (path: string) => string): string {
  return (content || "")
    .replace(/(!\[[^\]]*\]\()([^)]+)(\))/g, (_match, before, path, after) => `${before}${imagePath(path)}${after}`)
    .replace(/(<img\b[^>]*\bsrc\s*=\s*["'])([^"']+)(["'])/gi, (_match, before, path, after) => `${before}${imagePath(path)}${after}`);
}

export function storedAwsImageUrls(content: string): string {
  return mapImagePaths(content, storedAwsImagePath);
}

export function resourceAwsImageUrls(content: string, imagePath = awsImageResourcePath): string {
  return mapImagePaths(content, imagePath);
}
