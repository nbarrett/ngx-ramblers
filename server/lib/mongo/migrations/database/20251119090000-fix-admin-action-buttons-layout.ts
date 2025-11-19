import { Db, MongoClient } from "mongodb";
import createMigrationLogger from "../migrations-logger";

const debugLog = createMigrationLogger("fix-admin-action-buttons-layout");
const TARGET_PATH = "admin#action-buttons";

function normaliseHref(value: string | undefined): string {
  return (value || "").trim();
}

export async function up(db: Db, client: MongoClient) {
  const collection = db.collection("pageContent");
  const target = await collection.findOne({ path: TARGET_PATH });

  if (!target) {
    debugLog(`No page content found for path "${TARGET_PATH}"`);
    return;
  }

  const rows: any[] = Array.isArray(target.rows) ? target.rows : [];
  if (!rows.length) {
    debugLog(`Page content at "${TARGET_PATH}" has no rows`);
    return;
  }

  const actionButtonsIndex = rows.findIndex(row => row?.type === "action-buttons");
  if (actionButtonsIndex < 0) {
    debugLog(`No action-buttons row found for path "${TARGET_PATH}"`);
    return;
  }

  const extraColumns: any[] = [];
  const updatedRows = rows.map((row, index) => {
    if (index === actionButtonsIndex) {
      return row;
    }
    if (row?.type !== "text") {
      return row;
    }
    const columns: any[] = Array.isArray(row.columns) ? row.columns : [];
    if (columns.length <= 1) {
      return row;
    }
    const [firstColumn, ...restColumns] = columns;
    if (!restColumns.length) {
      return row;
    }
    extraColumns.push(...restColumns);
    return {
      ...row,
      columns: [firstColumn]
    };
  });

  const actionRow = updatedRows[actionButtonsIndex] || {};
  const existingColumns: any[] = Array.isArray(actionRow.columns) ? actionRow.columns : [];

  const combinedColumns = [...existingColumns, ...extraColumns];
  const seen = new Set<string>();
  const deDupedColumnsReversed: any[] = [];
  let removed = 0;

  for (let index = combinedColumns.length - 1; index >= 0; index--) {
    const column = combinedColumns[index];
    const key = normaliseHref(column?.href);
    if (!key) {
      deDupedColumnsReversed.push(column);
      continue;
    }
    if (seen.has(key)) {
      removed++;
      continue;
    }
    seen.add(key);
    deDupedColumnsReversed.push(column);
  }

  const deDupedColumns = deDupedColumnsReversed.reverse();

  updatedRows[actionButtonsIndex] = {
    ...actionRow,
    columns: deDupedColumns
  };

  await collection.updateOne({ _id: target._id }, { $set: { rows: updatedRows } });
  debugLog(`Moved ${extraColumns.length} action button column(s) into action-buttons row and removed ${removed} duplicate(s) for path "${TARGET_PATH}"`);
}

export async function down(db: Db, client: MongoClient) {
  debugLog("No down migration; admin action-buttons layout fix is not reversible");
}
