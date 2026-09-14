import {PutObjectCommand, S3} from "@aws-sdk/client-s3";
import {RootFolder} from "../../../projects/ngx-ramblers/src/app/models/system.model";
import {contentTypeFrom, extensionFrom} from "../aws/aws-utils";
import {generateUid} from "../shared/string-utils";

const s3 = new S3({});

export async function uploadMigrationBufferToS3(bucket: string, sourceName: string, buffer: Buffer, rootFolder = RootFolder.siteContent): Promise<string> {
  const fileName = generateUid() + extensionFrom(sourceName);
  const awsFileName = `${rootFolder}/${fileName}`;
  await s3.send(new PutObjectCommand({Bucket: bucket, Key: awsFileName, Body: buffer, ContentType: contentTypeFrom(sourceName)}));
  return awsFileName;
}
