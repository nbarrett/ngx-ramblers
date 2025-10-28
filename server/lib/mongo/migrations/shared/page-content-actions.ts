import { Db } from "mongodb";

export interface ActionButtonColumn {
  accessLevel?: string;
  title?: string;
  icon?: string;
  href?: string;
  contentText?: string;
}

const PAGE_CONTENT_COLLECTION = "pageContent";

function normaliseHref(value: string): string {
  return value?.trim();
}

function columnsWithoutTarget(columns: any[], targetHref: string): {filtered: any[]; removed: number} {
  const filtered = (columns || []).filter((column: any) => normaliseHref(column?.href) !== targetHref);
  const removed = (columns?.length || 0) - filtered.length;
  return {filtered, removed};
}

export async function removeActionButtonByHref(db: Db, path: string, href: string, log: (message: string) => void = () => {}): Promise<number> {
  const collection = db.collection(PAGE_CONTENT_COLLECTION);
  const target = await collection.findOne({ path });

  if (!target) {
    log(`No page content found for path "${path}"`);
    return 0;
  }

  const targetHref = normaliseHref(href);
  let totalRemoved = 0;
  const newRows = (target.rows || []).map((row: any) => {
    const {filtered, removed} = columnsWithoutTarget(row?.columns, targetHref);
    totalRemoved += removed;
    return removed > 0 ? {...row, columns: filtered} : row;
  });

  if (totalRemoved === 0) {
    log(`No action buttons with href "${href}" were found for path "${path}"`);
    return 0;
  }

  await collection.updateOne({ _id: target._id }, { $set: { rows: newRows } });
  log(`Removed ${totalRemoved} action button(s) with href "${href}" for path "${path}"`);
  return totalRemoved;
}

function hasExistingColumn(columns: any[], href: string): boolean {
  const targetHref = normaliseHref(href);
  return (columns || []).some(column => normaliseHref(column?.href) === targetHref);
}

export async function ensureActionButton(db: Db, path: string, column: ActionButtonColumn, log: (message: string) => void = () => {}): Promise<boolean> {
  const collection = db.collection(PAGE_CONTENT_COLLECTION);
  const target = await collection.findOne({ path });

  if (!target) {
    log(`Cannot add action button for "${path}" because the page content does not exist`);
    return false;
  }

  const rows = Array.isArray(target.rows) ? target.rows : [];
  if (rows.length === 0) {
    log(`Page content at "${path}" has no rows to append the action button to`);
    return false;
  }

  const firstRow = rows[0];
  if (hasExistingColumn(firstRow.columns, column.href)) {
    log(`Action button with href "${column.href}" already present on "${path}"`);
    return false;
  }

  const updatedRows = [{...firstRow, columns: [...(firstRow.columns || []), column]}, ...rows.slice(1)];
  await collection.updateOne({ _id: target._id }, { $set: { rows: updatedRows } });
  log(`Re-instated action button with href "${column.href}" on "${path}"`);
  return true;
}
