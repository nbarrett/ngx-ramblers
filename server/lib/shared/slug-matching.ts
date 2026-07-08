export function escapeSlugForRegex(slug: string): string {
  return (slug || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function slugPatternFor(identifier: string): string {
  return `(?:^|/)${escapeSlugForRegex(identifier)}$`;
}
