import type { Download } from "playwright-core";

const pendingDownloads = {current: null as Promise<Download> | null};

export function rememberPendingOsMapsDownload(download: Promise<Download>): void {
  pendingDownloads.current = download;
}

export function pendingOsMapsDownload(): Promise<Download> {
  if (!pendingDownloads.current) {
    throw new Error("No OS Maps GPX download has been started on this page");
  } else {
    return pendingDownloads.current;
  }
}

export function clearPendingOsMapsDownload(): void {
  pendingDownloads.current = null;
}
