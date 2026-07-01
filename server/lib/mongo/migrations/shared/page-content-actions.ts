import { Db } from "mongodb";
import { isArray } from "es-toolkit/compat";
import {
  ActionButtonColumn,
  PAGE_CONTENT_COLLECTION,
  PageContentType
} from "../../../../../projects/ngx-ramblers/src/app/models/content-text.model";

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

function actionButtonsRowIndex(rows: any[]): number {
  if (!isArray(rows)) {
    return -1;
  }
  return rows.findIndex(row => row?.type === PageContentType.ACTION_BUTTONS);
}

function deduplicateColumns(columns: any[]): {columns: any[]; removed: number} {
  const seen = new Set<string>();
  const deduplicated = (columns || []).filter(column => {
    const href = normaliseHref(column?.href);
    if (!href) {
      return true;
    }
    if (seen.has(href)) {
      return false;
    }
    seen.add(href);
    return true;
  });
  return {columns: deduplicated, removed: (columns?.length || 0) - deduplicated.length};
}

export async function deduplicateActionButtonsByHref(db: Db, path: string, log: (message: string) => void = () => {}): Promise<number> {
  const collection = db.collection(PAGE_CONTENT_COLLECTION);
  await deduplicatePageContentDocuments(db, path, log);
  const target = await collection.findOne({ path }, { sort: { _id: 1 } });
  if (!target) {
    return 0;
  }
  let removedCount = 0;
  const rows = (target.rows || []).map((row: any) => {
    if (row?.type !== PageContentType.ACTION_BUTTONS) {
      return row;
    }
    const result = deduplicateColumns(row.columns);
    removedCount += result.removed;
    return result.removed > 0 ? {...row, columns: result.columns} : row;
  });
  if (removedCount > 0) {
    await collection.updateOne({ _id: target._id }, { $set: { rows } });
    log(`Removed ${removedCount} duplicate action button column(s) at path "${path}"`);
  }
  return removedCount;
}

export async function deduplicatePageContentDocuments(db: Db, path: string, log: (message: string) => void = () => {}): Promise<number> {
  const collection = db.collection(PAGE_CONTENT_COLLECTION);
  const allDocuments = await collection.find({ path }).sort({ _id: 1 }).toArray();
  if (allDocuments.length <= 1) {
    return 0;
  }
  const survivor = allDocuments[0];
  const duplicates = allDocuments.slice(1);
  for (const dup of duplicates) {
    for (const dupRow of (dup.rows || [])) {
      const existingRow = (survivor.rows || []).find(
        (r: any) => r?.type === dupRow?.type
      );
      if (existingRow && dupRow?.columns) {
        for (const dupCol of dupRow.columns) {
          if (dupCol?.href && !existingRow.columns.some((c: any) => c?.href === dupCol.href)) {
            existingRow.columns.push(dupCol);
          }
        }
      } else if (!existingRow) {
        survivor.rows.push(dupRow);
      }
    }
  }
  await collection.updateOne({ _id: survivor._id }, { $set: { rows: survivor.rows } });
  const idsToRemove = duplicates.map(doc => doc._id);
  await collection.deleteMany({ _id: { $in: idsToRemove } });
  log(`Removed ${idsToRemove.length} duplicate page content document(s) at path "${path}"`);
  return idsToRemove.length;
}

export async function ensureActionButton(db: Db, path: string, column: ActionButtonColumn, log: (message: string) => void = () => {}): Promise<boolean> {
  const collection = db.collection(PAGE_CONTENT_COLLECTION);
  await deduplicateActionButtonsByHref(db, path, log);
  const target = await collection.findOne({ path });

  if (!target) {
    log(`Cannot add action button for "${path}" because the page content does not exist`);
    return false;
  }

  const rows: any[] = isArray(target.rows) ? target.rows : [];
  if (rows.length === 0) {
    log(`Page content at "${path}" has no rows to append the action button to`);
    return false;
  }

  const targetRowPosition = actionButtonsRowIndex(rows) >= 0 ? actionButtonsRowIndex(rows) : 0;
  const targetRow = rows[targetRowPosition];

  if (hasExistingColumn(targetRow?.columns, column.href)) {
    log(`Action button with href "${column.href}" already present on "${path}"`);
    return false;
  }

  const updatedRows = rows.map((row, index) => {
    if (index !== targetRowPosition) {
      return row;
    }
    return {
      ...row,
      columns: [...(row?.columns || []), column]
    };
  });
  await collection.updateOne({ _id: target._id }, { $set: { rows: updatedRows } });
  log(`Added action button with href "${column.href}" on "${path}"`);
  return true;
}

export async function syncActionButtonDetailsByHref(db: Db, path: string, columns: ActionButtonColumn[], log: (message: string) => void = () => {}): Promise<number> {
  const collection = db.collection(PAGE_CONTENT_COLLECTION);
  const target = await collection.findOne({ path }, { sort: { _id: 1 } });

  if (!target) {
    log(`No page content found for path "${path}"`);
    return 0;
  }

  let updatedCount = 0;
  const rows = (target.rows || []).map((row: any) => {
    if (row?.type !== PageContentType.ACTION_BUTTONS) {
      return row;
    }
    const updatedColumns = (row.columns || []).map((column: any) => {
      const match = columns.find(item => normaliseHref(item.href) === normaliseHref(column?.href));
      if (!match) {
        return column;
      }
      if (column?.title === match.title && column?.icon === match.icon && column?.contentText === match.contentText) {
        return column;
      }
      updatedCount++;
      log(`Updating action button "${column?.title}" to "${match.title}" for href "${match.href}" on "${path}"`);
      return {...column, title: match.title, icon: match.icon, contentText: match.contentText};
    });
    return {...row, columns: updatedColumns};
  });

  if (updatedCount === 0) {
    return 0;
  }

  await collection.updateOne({ _id: target._id }, { $set: { rows } });
  log(`Updated ${updatedCount} action button(s) on "${path}"`);
  return updatedCount;
}

export async function ensureActionButtons(db: Db, path: string, columns: ActionButtonColumn[], log: (message: string) => void = () => {}): Promise<number> {
  let addedCount = 0;
  for (const column of columns) {
    const added = await ensureActionButton(db, path, column, log);
    if (added) {
      addedCount++;
    }
  }
  return addedCount;
}
