import { RamblersUploadAudit } from "../models/ramblers-upload-audit.model";
import { UrlService } from "../services/url.service";

export function serenityReportUrl(audit: RamblersUploadAudit): string | null {
  if (!audit.reportKeyPrefix || !audit.reportBucket) {
    return null;
  } else {
    const bucket = audit.reportBucket.replace(/^\/+|\/+$/g, "");
    const keyPrefix = audit.reportKeyPrefix.replace(/^\/+|\/+$/g, "");
    return `api/aws/report/${bucket}/${keyPrefix}/_/index.html`;
  }
}

export function openSerenityReport(audit: RamblersUploadAudit, event: MouseEvent, urlService: UrlService): void {
  const url = serenityReportUrl(audit);
  if (url) {
    urlService.navigateToUrl(url, event);
  }
}
