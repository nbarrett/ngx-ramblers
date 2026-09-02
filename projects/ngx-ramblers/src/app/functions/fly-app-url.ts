export function flyAppUrl(appName: string): string {
  const name = (appName || "").trim();
  if (name) {
    return `https://fly.io/apps/${encodeURIComponent(name)}`;
  } else {
    return "";
  }
}

export function flyAppMetricsUrl(appName: string): string {
  const url = flyAppUrl(appName);
  if (url) {
    return `${url}/metrics`;
  } else {
    return "";
  }
}
