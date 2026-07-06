import debug from "debug";
import { envConfig } from "../env-config/env-config";
import { InboxAttachment } from "../../../projects/ngx-ramblers/src/app/models/inbox.model";

const debugLog = debug(envConfig.logNamespace("inbox-attachment-store"));
debugLog.enabled = true;

export async function storeInboxAttachmentBuffer(filename: string, contentType: string, buffer: Buffer, contentId: string | null, sizeBytes?: number): Promise<InboxAttachment> {
  const safeName = filename || "attachment";
  const size = sizeBytes || buffer.length;
  const metadataOnly: InboxAttachment = {filename: safeName, contentType, sizeBytes: size, s3Key: "", contentId};
  const [
    {RootFolder},
    {putBufferDirect},
    {generateAwsFileName, isAwsUploadErrorResponse}
  ] = await Promise.all([
    import("../../../projects/ngx-ramblers/src/app/models/system.model"),
    import("../aws/aws-controllers"),
    import("../aws/aws-utils")
  ]);
  const awsFileName = generateAwsFileName(safeName);
  const uploadResult = await putBufferDirect(RootFolder.inboxAttachments, awsFileName, buffer, contentType);
  if (isAwsUploadErrorResponse(uploadResult)) {
    debugLog("attachment upload to S3 failed for", safeName, "->", uploadResult.error);
    return metadataOnly;
  }
  return {filename: safeName, contentType, sizeBytes: size, s3Key: `${RootFolder.inboxAttachments}/${awsFileName}`, contentId};
}
