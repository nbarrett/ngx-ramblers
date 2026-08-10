import crypto from "crypto";
import { ResolvedAlbumImage } from "../../../projects/ngx-ramblers/src/app/models/social-publish.model";
import { RootFolder } from "../../../projects/ngx-ramblers/src/app/models/system.model";
import { objectBufferForKey, putBufferDirect } from "../aws/aws-controllers";
import { isAwsUploadErrorResponse } from "../aws/aws-utils";
import { prepareInstagramImage } from "./instagram-image-transform";

const INSTAGRAM_SOURCE_PATH = "/api/aws/s3/";
const INSTAGRAM_ASSET_FOLDER = `${RootFolder.socialPublishing}/instagram`;

function objectKeyFrom(imageUrl: string): string {
  const pathname = new URL(imageUrl).pathname;
  if (!pathname.startsWith(INSTAGRAM_SOURCE_PATH)) {
    throw new Error(`Instagram image URL is not an S3 album image: ${imageUrl}`);
  } else {
    return decodeURIComponent(pathname.slice(INSTAGRAM_SOURCE_PATH.length));
  }
}

async function prepareAlbumImage(image: ResolvedAlbumImage): Promise<ResolvedAlbumImage> {
  const input = await objectBufferForKey(objectKeyFrom(image.url));
  const prepared = await prepareInstagramImage(input);
  let result = image;
  if (prepared.transformed) {
    const fileName = `${crypto.createHash("sha256").update(input.toString("base64")).digest("hex")}.jpg`;
    const uploaded = await putBufferDirect(INSTAGRAM_ASSET_FOLDER, fileName, prepared.body, "image/jpeg");
    if (isAwsUploadErrorResponse(uploaded)) {
      throw new Error(uploaded.error);
    } else {
      const origin = new URL(image.url).origin;
      result = {...image, url: `${origin}${INSTAGRAM_SOURCE_PATH}${INSTAGRAM_ASSET_FOLDER}/${fileName}`};
    }
  }
  return result;
}

export async function prepareInstagramAlbumImages(images: ResolvedAlbumImage[]): Promise<ResolvedAlbumImage[]> {
  return images.reduce(
    async (preparedImages, image) => [...await preparedImages, await prepareAlbumImage(image)],
    Promise.resolve([] as ResolvedAlbumImage[])
  );
}
