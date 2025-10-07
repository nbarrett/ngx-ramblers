import debug from "debug";
import { envConfig } from "../../env-config/env-config";
import * as mongooseClient from "../../mongo/mongoose-client";
import { pageContent as pageContentModel } from "../../mongo/models/page-content";
import { contentText as contentTextModel } from "../../mongo/models/content-text";
import { PageContent, PageContentColumn, PageContentRow } from "../../../../projects/ngx-ramblers/src/app/models/content-text.model";

const log = debug(envConfig.logNamespace("inline-content-text-migration"));
log.enabled = true;

type Options = { dryRun?: boolean; limitPaths?: string[] };

export async function migrateInlineContentText(options: Options = {}): Promise<{ updated: number; scanned: number }> {
  const { dryRun = true, limitPaths } = options;
  await mongooseClient.connect(log);
  const criteria: any = limitPaths && limitPaths.length ? { path: { $in: limitPaths } } : {};
  const docs: PageContent[] = await pageContentModel.find(criteria).lean();
  let updated = 0;
  for (const doc of docs) {
    const original = JSON.stringify(doc);
    const rows = await migrateRows(doc.rows || []);
    const migrated: PageContent = { ...doc, rows } as any;
    const changed = JSON.stringify(migrated) !== original;
    if (changed) {
      updated++;
      if (dryRun) {
        log("Would update path:", doc.path);
      } else {
        await mongooseClient.upsert<PageContent>(pageContentModel, { path: doc.path }, migrated);
        log("Updated path:", doc.path);
      }
    }
  }
  return { updated, scanned: docs.length };
}

async function migrateRows(rows: PageContentRow[]): Promise<PageContentRow[]> {
  const out: PageContentRow[] = [];
  for (const row of rows) {
    const newRow: PageContentRow = { ...row, columns: [] } as any;
    for (const col of row.columns || []) {
      const newCol: PageContentColumn = { ...col } as any;
      if ((newCol as any).contentTextId && !(newCol as any).contentText) {
        const textId = (newCol as any).contentTextId as string;
        try {
          const ct = await contentTextModel.findById(textId).lean();
          if (ct?.text) {
            (newCol as any).contentText = ct.text;
            delete (newCol as any).contentTextId;
          }
        } catch (error) {
          log("Failed to inline contentTextId", textId, error);
        }
      }
      if ((newCol as any).rows) {
        (newCol as any).rows = await migrateRows(((newCol as any).rows || []) as PageContentRow[]);
      }
      (newRow.columns as any).push(newCol);
    }
    out.push(newRow);
  }
  return out;
}
