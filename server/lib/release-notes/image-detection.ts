/**
 * Detects whether a CMS PageContent carries any images.
 *
 * Release-notes pages store images in many shapes depending on how they were
 * authored. This module centralises the detection logic so it can be tested
 * and reused both by the automated workflow and by one-off recovery scripts.
 */

import { isArray, isObject, isString } from "es-toolkit/compat";

const MARKDOWN_IMAGE_REGEX = /!\[[^\]]*]\([^)]+\)/;
const HTML_IMAGE_REGEX = /<img\b[^>]*\bsrc\s*=/i;

export function textHasImage(text: unknown): boolean {
  if (!isString(text) || !text) return false;
  return MARKDOWN_IMAGE_REGEX.test(text) || HTML_IMAGE_REGEX.test(text);
}

/**
 * The CMS editor attaches a default-initialised `carousel` object to many
 * plain text rows, even when there is no album linked. All its fields are
 * null in that state. Only treat a carousel as image-bearing when it names
 * or identifies a real album.
 */
export function carouselHasContent(carousel: any): boolean {
  if (!isObject(carousel)) return false;
  const c = carousel as any;
  return Boolean(c.name || c.albumName || c.albumId || c.eventId);
}

export function albumIndexHasContent(albumIndex: any): boolean {
  if (!isObject(albumIndex)) return false;
  const a = albumIndex as any;
  return Boolean(a.name || a.id || (isArray(a.albums) && a.albums.length > 0));
}

export function columnHasImage(col: any): boolean {
  if (!col) return false;
  if (col.imageSource) return true;
  if (col.icon) return true;
  if (textHasImage(col.contentText)) return true;
  if (isArray(col.rows)) {
    for (const nestedRow of col.rows) {
      if (rowHasImage(nestedRow)) return true;
    }
  }
  return false;
}

export function rowHasImage(row: any): boolean {
  if (!row) return false;
  if (carouselHasContent(row.carousel)) return true;
  if (albumIndexHasContent(row.albumIndex)) return true;
  if (isArray(row.columns)) {
    for (const col of row.columns) {
      if (columnHasImage(col)) return true;
    }
  }
  return false;
}

export function pageHasImages(page: any): boolean {
  if (!page?.rows) return false;
  for (const row of page.rows) {
    if (rowHasImage(row)) return true;
  }
  return false;
}
