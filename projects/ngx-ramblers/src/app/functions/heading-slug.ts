const HEADING_PUNCTUATION = /[\u2000-\u206F\u2E00-\u2E7F\\'!"#$%&()*+,./:;<=>?@[\]^`{|}~]/g;

export function headingSlug(value: string): string {
  return value.toLowerCase().replace(HEADING_PUNCTUATION, "").replace(/\s/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
}

export function headingAnchorId(value: string, seen: Map<string, number>): string {
  const base = headingSlug(value.trim()) || "section";
  const count = seen.get(base) || 0;
  seen.set(base, count + 1);
  if (count === 0) {
    return base;
  } else {
    return `${base}-${count}`;
  }
}
