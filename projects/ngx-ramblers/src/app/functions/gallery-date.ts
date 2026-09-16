import { GalleryDate } from "../models/migration-scraping.model";

const MONTHS: {month: number; names: string[]}[] = [
  {month: 1, names: ["january", "jan"]},
  {month: 2, names: ["february", "feb"]},
  {month: 3, names: ["march", "mar"]},
  {month: 4, names: ["april", "apr"]},
  {month: 5, names: ["may"]},
  {month: 6, names: ["june", "jun"]},
  {month: 7, names: ["july", "jul"]},
  {month: 8, names: ["august", "aug"]},
  {month: 9, names: ["september", "sept", "sep"]},
  {month: 10, names: ["october", "oct"]},
  {month: 11, names: ["november", "nov"]},
  {month: 12, names: ["december", "dec"]}
];

export const MONTH_NAME_PATTERN = new RegExp(`\\b(${MONTHS.flatMap(item => item.names).join("|")})\\b`, "gi");

function decoded(text: string): string {
  try {
    return decodeURIComponent(text || "");
  } catch {
    return text || "";
  }
}

export function monthNumberFrom(name: string): number | null {
  const lower = (name || "").toLowerCase();
  return MONTHS.find(item => item.names.includes(lower))?.month || null;
}

export function fullMonthName(month: number): string {
  return MONTHS.find(item => item.month === month)?.names[0] || "";
}

function exactDateIn(text: string): GalleryDate | null {
  const match = text.match(/(?:^|\D)((?:19|20)\d{2})(\d{2})(\d{2})(?:\D|$)/);
  const year = match ? Number(match[1]) : 0;
  const month = match ? Number(match[2]) : 0;
  const day = match ? Number(match[3]) : 0;
  return match && month >= 1 && month <= 12 && day >= 1 && day <= 31 ? {year, month, day} : null;
}

function monthAndYearIn(text: string): GalleryDate | null {
  const year = text.match(/\b((?:19|20)\d{2})\b/);
  const monthName = [...text.matchAll(MONTH_NAME_PATTERN)].map(match => match[1]).pop();
  if (!year) {
    return null;
  } else {
    return {year: Number(year[1]), month: monthName ? monthNumberFrom(monthName) : null, day: null};
  }
}

export function galleryDateFrom(...texts: string[]): GalleryDate | null {
  const sources = texts.filter(text => !!text).map(decoded);
  const exact = sources.map(exactDateIn).find(date => !!date);
  const monthly = sources.map(monthAndYearIn).filter(date => !!date);
  return exact || monthly.find(date => !!date.month) || monthly[0] || null;
}
