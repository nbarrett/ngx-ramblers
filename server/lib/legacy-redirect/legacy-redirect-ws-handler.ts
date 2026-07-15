import WebSocket from "ws";
import { pluraliseWithCount } from "../shared/string-utils";
import debug from "debug";
import { envConfig } from "../env-config/env-config";
import { MessageType } from "../../../projects/ngx-ramblers/src/app/models/websocket.model";
import { LegacyScrapeRequest } from "../../../projects/ngx-ramblers/src/app/models/legacy-url-redirect.model";
import { scrapeLegacySite } from "./legacy-url-scraper";
import { autoMapLegacyUrls } from "./auto-mapper";
import { legacyScrapeRun } from "../mongo/models/legacy-scrape-run";
import * as mongooseClient from "../mongo/mongoose-client";
import { dateTimeNowAsValue } from "../shared/dates";

const debugLog = debug(envConfig.logNamespace("legacy-redirect-ws"));

export async function reconcileOrphanedScrapeRuns(): Promise<void> {
  try {
    const now = dateTimeNowAsValue();
    const result = await legacyScrapeRun.updateMany(
      { status: "running" },
      {
        $set: { status: "failed", completedDate: now },
        $push: { auditLog: { time: now, status: "error", message: "Scrape interrupted by a server restart and could not be resumed" } }
      }
    );
    if (result.modifiedCount > 0) {
      debugLog(`reconcileOrphanedScrapeRuns: marked ${pluraliseWithCount(result.modifiedCount, "interrupted scrape run")} as failed`);
    }
  } catch (error) {
    debugLog("reconcileOrphanedScrapeRuns error:", error);
  }
}

export async function handleLegacyUrlScrape(ws: WebSocket, data: LegacyScrapeRequest): Promise<void> {
  const domain = data?.legacyDomain;
  if (!domain) {
    ws.send(JSON.stringify({ type: MessageType.ERROR, data: { message: "legacyDomain is required" } }));
    return;
  }

  const parsedDomain = domain.startsWith("http") ? new URL(domain).hostname : domain;
  let history: any = null;

  try {
    history = await mongooseClient.create<any>(legacyScrapeRun as any, {
      legacyDomain: parsedDomain,
      startedDate: dateTimeNowAsValue(),
      status: "running",
      urlsDiscovered: 0,
      urlsMapped: 0,
      urlsUnmapped: 0,
      auditLog: []
    });

    const addAuditLog = async (message: string, status = "info") => {
      try {
        const log = { time: dateTimeNowAsValue(), status, message };
        if (history) {
          history.auditLog = [...(history.auditLog || []), log];
          await mongooseClient.upsert<any>(legacyScrapeRun as any, { _id: history.id }, history);
        }
      } catch (e) {
        debugLog("audit log error:", e);
      }
    };

    ws.send(JSON.stringify({
      type: MessageType.PROGRESS,
      data: { message: `starting scrape for ${parsedDomain}`, percent: 0 }
    }));

    const onProgress = (message: string, percent?: number) => {
      ws.send(JSON.stringify({ type: MessageType.PROGRESS, data: { message, percent } }));
      addAuditLog(message);
    };

    const scrapeResult = await scrapeLegacySite(data, onProgress);

    ws.send(JSON.stringify({
      type: MessageType.PROGRESS,
      data: { message: `scrape complete, running auto-mapping...`, percent: 95 }
    }));
    await addAuditLog("scrape complete, running auto-mapping");

    const mapResult = await autoMapLegacyUrls(parsedDomain);

    const summary = `scraped ${scrapeResult.urlsDiscovered} URLs, auto-mapped: ${mapResult.high} high, ${mapResult.medium} medium, ${mapResult.low} low, ${mapResult.unmapped} unmapped`;

    if (history) {
      history.completedDate = dateTimeNowAsValue();
      history.status = "completed";
      history.urlsDiscovered = scrapeResult.urlsDiscovered;
      history.urlsMapped = mapResult.high + mapResult.medium + mapResult.low;
      history.urlsUnmapped = mapResult.unmapped;
      await mongooseClient.upsert<any>(legacyScrapeRun as any, { _id: history.id }, history);
    }

    ws.send(JSON.stringify({
      type: MessageType.COMPLETE,
      data: { message: summary, scrapeResult, mapResult }
    }));
  } catch (error) {
    const message = error?.message || "legacy URL scrape failed";
    debugLog("scrape error:", error);

    if (history) {
      try {
        history.completedDate = dateTimeNowAsValue();
        history.status = "failed";
        history.auditLog = [...(history.auditLog || []), { time: dateTimeNowAsValue(), status: "error", message }];
        await mongooseClient.upsert<any>(legacyScrapeRun as any, { _id: history.id }, history);
      } catch (e) {
        debugLog("failed to update history on error:", e);
      }
    }

    ws.send(JSON.stringify({ type: MessageType.ERROR, data: { message } }));
  }
}
