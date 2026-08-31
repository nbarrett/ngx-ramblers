import debugLib from "debug";
import { envConfig } from "../env-config/env-config";
import { pageContent } from "../mongo/models/page-content";
import { CommitteeFile } from "../../../projects/ngx-ramblers/src/app/models/committee.model";
import { PageContent } from "../../../projects/ngx-ramblers/src/app/models/content-text.model";
import { UIDateFormat } from "../../../projects/ngx-ramblers/src/app/models/date-format.model";
import {
  addCommitteeFileIdToPage,
  COMMITTEE_DOCUMENTS_YEAR_PATH_PATTERN,
  committeeDocumentsRow,
  committeeDocumentsYearPath
} from "../../../projects/ngx-ramblers/src/app/functions/committee-documents-page";
import { dateTimeFromMillis, formatDateTime } from "../shared/dates";

const debug = debugLib(envConfig.logNamespace("committee:documents-page"));
debug.enabled = true;

export async function addCommitteeFileToDocumentsPage(file: CommitteeFile): Promise<string | null> {
  const fileId = file?.id;
  if (!fileId) {
    debug("not adding committee file without id");
    return null;
  } else {
    const year = formatDateTime(dateTimeFromMillis(file.eventDate), UIDateFormat.YEAR);
    const yearPage = await pageContent.findOne({path: committeeDocumentsYearPath(year)}).exec();
    const target = yearPage || await latestYearDocumentsPage();
    if (!target) {
      debug("no committee documents page found for file", fileId, "year", year);
      return null;
    } else {
      const page = target.toObject() as unknown as PageContent;
      if (!committeeDocumentsRow(page)?.committeeDocuments) {
        debug("committee page has no documents row", target.path);
        return null;
      } else if (addCommitteeFileIdToPage(page, fileId)) {
        target.set("rows", page.rows);
        await target.save();
        debug("added committee file", fileId, "to", target.path);
      }
      return target.path || null;
    }
  }
}

async function latestYearDocumentsPage() {
  const pages = await pageContent.find({path: {$regex: COMMITTEE_DOCUMENTS_YEAR_PATH_PATTERN}}).sort({path: -1}).exec();
  return pages.find(page => !!committeeDocumentsRow(page.toObject() as unknown as PageContent)) || null;
}
