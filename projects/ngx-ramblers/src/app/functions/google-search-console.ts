export function extractGoogleSiteVerificationId(raw: string): string {
  if (!raw) {
    return raw;
  }
  const trimmed = raw.trim();
  const metaMatch = trimmed.match(/content\s*=\s*["']([^"']+)["']/i);
  return metaMatch ? metaMatch[1].trim() : trimmed;
}
