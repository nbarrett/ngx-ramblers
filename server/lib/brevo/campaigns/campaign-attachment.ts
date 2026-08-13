import { Request } from "express";
import { BREVO_SUPPORTED_ATTACHMENT_EXTENSIONS } from "../../../../projects/ngx-ramblers/src/app/models/mail.model";
import { S3_BASE_URL } from "../../../../projects/ngx-ramblers/src/app/models/content-metadata.model";
import { RootFolder } from "../../../../projects/ngx-ramblers/src/app/models/system.model";
import { putBufferDirect } from "../../aws/aws-controllers";
import { generateAwsFileName, isAwsUploadErrorResponse } from "../../aws/aws-utils";
import { meetingCalendarFile } from "../../calendar/calendar-controllers";
import { systemConfig } from "../../config/system-config";
import { publicImageBaseUrl } from "../../social/public-base-url";

const MEETING_CALENDAR_PATH = /\/api\/calendar\/meeting\/([^/?#]+)/i;

export function attachmentExtensionFromUrl(url: string): string {
  try {
    const pathname = new URL(url).pathname;
    const lastSegment = pathname.split("/").pop() || "";
    const dot = lastSegment.lastIndexOf(".");
    return dot >= 0 ? lastSegment.slice(dot + 1).toLowerCase() : "";
  } catch {
    return "";
  }
}

export function meetingRoomFromAttachmentUrl(url: string): string | null {
  const match = (url || "").match(MEETING_CALENDAR_PATH);
  return match ? decodeURIComponent(match[1].replace(/\.ics$/i, "")) : null;
}

function localAttachmentHost(url: string): boolean {
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "0.0.0.0";
  } catch {
    return false;
  }
}

export async function publicCampaignAttachmentUrl(attachmentUrl: string | null | undefined, req: Request): Promise<string | undefined> {
  if (!attachmentUrl) {
    return undefined;
  } else {
    const extension = attachmentExtensionFromUrl(attachmentUrl);
    const brevoCanFetch = BREVO_SUPPORTED_ATTACHMENT_EXTENSIONS.includes(extension) && !localAttachmentHost(attachmentUrl);
    if (brevoCanFetch) {
      return attachmentUrl;
    } else {
      return storeCampaignAttachment(attachmentUrl, req);
    }
  }
}

async function storeCampaignAttachment(attachmentUrl: string, req: Request): Promise<string> {
  const room = meetingRoomFromAttachmentUrl(attachmentUrl);
  if (!room) {
    throw new Error("The mail platform could not fetch that attachment. Use a public file with a recognised extension, such as .ics or .pdf.");
  } else {
    const file = await meetingCalendarFile(room, req);
    if (!file) {
      throw new Error("The meeting calendar attachment could not be generated.");
    } else {
      const awsFileName = generateAwsFileName(file.fileName);
      const uploaded = await putBufferDirect(RootFolder.emailAttachments, awsFileName, Buffer.from(file.document, "utf8"), "text/calendar");
      if (isAwsUploadErrorResponse(uploaded)) {
        throw new Error("The meeting calendar could not be stored for sending.");
      } else {
        const config = await systemConfig();
        const base = publicImageBaseUrl(req, config).replace(/\/+$/, "");
        return `${base}/${S3_BASE_URL}/${RootFolder.emailAttachments}/${awsFileName}`;
      }
    }
  }
}
