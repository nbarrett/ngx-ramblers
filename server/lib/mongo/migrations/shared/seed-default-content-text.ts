import { Db } from "mongodb";
import { ContentTextSeedResult } from "../../../../../projects/ngx-ramblers/src/app/models/content-text.model";
import { DEFAULT_CONTENT_ENTRIES } from "../../../../../projects/ngx-ramblers/src/app/pages/admin/default-content";
import { pluraliseWithCount } from "../../../shared/string-utils";
import { insertMissingContentText } from "./upsert-content-text";

export async function seedMissingDefaultContentText(
  db: Db,
  log: (message: string) => void = () => {}
): Promise<{ inserted: number; filled: number; skipped: number }> {
  const progress = { inserted: 0, filled: 0, skipped: 0 };
  for (const entry of DEFAULT_CONTENT_ENTRIES) {
    if (!entry.name || !entry.category || entry.text === undefined) {
      log(`Skipped catalog entry without name, category or text: ${entry.name}`);
    } else {
      const result = await insertMissingContentText(db, entry, log);
      if (result === ContentTextSeedResult.INSERTED) {
        progress.inserted += 1;
      } else if (result === ContentTextSeedResult.FILLED) {
        progress.filled += 1;
      } else {
        progress.skipped += 1;
      }
    }
  }
  log(
    `Catalog seed ${pluraliseWithCount(progress.inserted, "insert")}, ` +
    `${pluraliseWithCount(progress.filled, "empty record filled")}, ` +
    `${pluraliseWithCount(progress.skipped, "existing record left")}`
  );
  return progress;
}
