export const MAXIMUM_RAMBLERS_WALK_IMAGES = 5;

export function imageFileNameFrom(url: string): string {
  if (!url) {
    return "";
  }
  const withoutQuery = url.split("?")[0];
  const lastSegment = withoutQuery.split("/").pop() || "";
  try {
    return decodeURIComponent(lastSegment);
  } catch {
    return lastSegment;
  }
}

export function imageIdentity(value: string): string {
  const fileName = imageFileNameFrom(value);
  const extensionIndex = fileName.lastIndexOf(".");
  const stem = extensionIndex > 0 ? fileName.slice(0, extensionIndex) : fileName;
  return stem
    .toLowerCase()
    .replace(/_\d+$/, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function normalisedAlternativeText(value: string): string {
  return (value || "").trim().toLowerCase().replace(/\s+/g, " ");
}
