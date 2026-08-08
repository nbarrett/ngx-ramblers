import debug from "debug";
import { Request, Response } from "express";
import { isString } from "es-toolkit/compat";
import { envConfig } from "../env-config/env-config";
import { configuredEnvironments } from "../environments/environments-config";
import { UIDateFormat } from "../../../projects/ngx-ramblers/src/app/models/date-format.model";
import { dateTimeNow, formatDateTime } from "../shared/dates";
import {
  EstateRebuildCaptureFormat
} from "./estate-rebuild-capture.model";
import { PLATFORM_FIELDS, SITE_FIELDS } from "./estate-rebuild-fields";
import { generateEstateRebuildArtifacts, generateEstateRebuildInventory } from "./generate-estate-rebuild-capture";

const debugLog = debug(envConfig.logNamespace("ops:estate-rebuild-capture-controllers"));
debugLog.enabled = true;

function formatFromRequest(req: Request): EstateRebuildCaptureFormat {
  const raw = isString(req.query?.format) ? req.query.format.toLowerCase() : EstateRebuildCaptureFormat.XLSX;
  if (raw === EstateRebuildCaptureFormat.MARKDOWN || raw === "markdown") {
    return EstateRebuildCaptureFormat.MARKDOWN;
  } else if (raw === EstateRebuildCaptureFormat.HTML) {
    return EstateRebuildCaptureFormat.HTML;
  } else {
    return EstateRebuildCaptureFormat.XLSX;
  }
}

function includeSecretsFromRequest(req: Request): boolean {
  const raw = req.query?.includeSecrets;
  if (isString(raw)) {
    return raw !== "false" && raw !== "0" && raw !== "no";
  } else {
    return true;
  }
}

export async function downloadEstateRebuildCapture(req: Request, res: Response): Promise<void> {
  try {
    const format = formatFromRequest(req);
    const includeSecrets = includeSecretsFromRequest(req);
    debugLog("Generating platform configuration values format=%s includeSecrets=%s", format, includeSecrets);
    const artifacts = await generateEstateRebuildArtifacts({includeSecrets});
    const stamp = formatDateTime(dateTimeNow(), UIDateFormat.FILE_TIMESTAMP_COMPACT);
    const secretSuffix = includeSecrets ? "-with-secrets" : "";
    if (format === EstateRebuildCaptureFormat.MARKDOWN) {
      res.setHeader("Content-Type", "text/markdown; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="platform-configuration-values${secretSuffix}-${stamp}.md"`);
      res.send(artifacts.markdown);
    } else if (format === EstateRebuildCaptureFormat.HTML) {
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="platform-configuration-values${secretSuffix}-${stamp}.html"`);
      res.send(artifacts.html);
    } else {
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", `attachment; filename="platform-configuration-values${secretSuffix}-${stamp}.xlsx"`);
      res.send(artifacts.xlsx);
    }
  } catch (error) {
    debugLog("Platform configuration values failed: %s", error?.stack || error);
    res.status(500).json({error: error?.message || "Failed to generate platform configuration values"});
  }
}

export async function estateRebuildCaptureSummary(_req: Request, res: Response): Promise<void> {
  try {
    const environmentsConfig = await configuredEnvironments();
    const siteCount = (environmentsConfig.environments || []).length;
    res.json({
      generatedAtUtc: formatDateTime(dateTimeNow(), UIDateFormat.DISPLAY_DATE_AND_TIME),
      siteCount,
      fieldsPerSite: SITE_FIELDS.length,
      siteCaptureRows: siteCount * SITE_FIELDS.length,
      platformFieldCount: PLATFORM_FIELDS.length,
      formats: [
        EstateRebuildCaptureFormat.XLSX,
        EstateRebuildCaptureFormat.MARKDOWN,
        EstateRebuildCaptureFormat.HTML
      ]
    });
  } catch (error) {
    debugLog("Platform configuration values summary failed: %s", error?.stack || error);
    res.status(500).json({error: error?.message || "Failed to load platform configuration values summary"});
  }
}

export async function estateRebuildCaptureInventory(req: Request, res: Response): Promise<void> {
  try {
    const raw = req.query?.includeSecrets;
    const includeSecrets = isString(raw)
      ? (raw === "true" || raw === "1" || raw === "yes")
      : false;
    debugLog("Generating platform configuration inventory includeSecrets=%s", includeSecrets);
    const inventory = await generateEstateRebuildInventory({includeSecrets});
    res.json(inventory);
  } catch (error) {
    debugLog("Platform configuration inventory failed: %s", error?.stack || error);
    res.status(500).json({error: error?.message || "Failed to generate platform configuration inventory"});
  }
}
