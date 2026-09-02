import debugLib from "debug";
import { envConfig } from "../env-config/env-config";
import { pageContent } from "../mongo/models/page-content";
import { CommitteeConfig, CommitteeFile } from "../../../projects/ngx-ramblers/src/app/models/committee.model";
import { CommitteeDocumentsPageChoice, PageContent, PageContentType } from "../../../projects/ngx-ramblers/src/app/models/content-text.model";
import { UIDateFormat } from "../../../projects/ngx-ramblers/src/app/models/date-format.model";
import { ConfigKey } from "../../../projects/ngx-ramblers/src/app/models/config.model";
import { queryKey } from "../mongo/controllers/config";
import {
  addCommitteeFileIdToPage,
  committeeDocumentsPageLabel,
  committeeDocumentsRow,
  preferredCommitteeDocumentsPagePath
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
    const records = await pageContent.find({"rows.type": PageContentType.COMMITTEE_DOCUMENTS}).sort({path: 1}).exec();
    const pages = records
      .map(record => record.toObject() as unknown as PageContent)
      .filter(page => !!committeeDocumentsRow(page) && !!page.path);
    const choices: CommitteeDocumentsPageChoice[] = pages.map(page => ({
      path: page.path,
      label: committeeDocumentsPageLabel(page)
    }));
    const committeeConfig = (await queryKey(ConfigKey.COMMITTEE))?.value as CommitteeConfig;
    const path = preferredCommitteeDocumentsPagePath(
      choices,
      committeeConfig?.documentsPagePath || null,
      file.meeting?.committeePagePath || null,
      year
    );
    const target = records.find(record => record.path === path);
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
