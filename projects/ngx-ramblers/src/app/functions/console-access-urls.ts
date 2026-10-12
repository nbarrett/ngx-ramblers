import { ConsoleAccessResolvedUrlInfo, ConsoleAccessUrlInfo } from "../models/environment-setup.model";

export function resolveConsoleUrls(
  urls: ConsoleAccessUrlInfo[],
  identifiers: Record<string, string> | undefined
): ConsoleAccessResolvedUrlInfo[] {
  const values = identifiers || {};
  return urls.reduce((acc: ConsoleAccessResolvedUrlInfo[], template) => {
    const placeholders: string[] = template.urlTemplate.match(/\{([a-zA-Z0-9_]+)\}/g) || [];
    const missing = placeholders.some(token => {
      const key = token.slice(1, -1);
      return !values[key];
    });
    if (!missing) {
      const url = placeholders.reduce((current: string, token: string) => {
        const key = token.slice(1, -1);
        return current.split(token).join(encodeURIComponent(values[key]));
      }, template.urlTemplate);
      acc.push({
        label: template.label,
        url,
        iconKey: template.iconKey || null
      });
    }
    return acc;
  }, []);
}
