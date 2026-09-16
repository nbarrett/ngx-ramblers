import { randomUUID } from "crypto";
import { SiteMigrationConfig } from "../../../projects/ngx-ramblers/src/app/models/migration-config.model";
import { PageContent } from "../../../projects/ngx-ramblers/src/app/models/content-text.model";
import { RegistrationMigrationTemplate, RegistrationPhotoTemplates } from "../../../projects/ngx-ramblers/src/app/models/site-registration.model";
import { pageContent } from "../mongo/models/page-content";
import { MigrationResult } from "../../../projects/ngx-ramblers/src/app/models/migration-scraping.model";
import { IntegrationWorkerResultStatus } from "../../../projects/ngx-ramblers/src/app/models/integration-worker.model";
import { sanitiseRegistrationMessage } from "../../../projects/ngx-ramblers/src/app/functions/registration-progress";
import { dateTimeNowAsValue } from "../shared/dates";
import { cancelMigrationJobOnIntegrationWorker, submitMigrationJobToIntegrationWorker } from "../ramblers/integration-worker-browser-client";
import debug from "debug";
import { envConfig } from "../env-config/env-config";
import { completeMigrationSession, registerMigrationSession } from "../migration/migration-session-registry";

const IMPORT_TIMEOUT_MS = 25 * 60 * 1000;
const debugLog = debug(envConfig.logNamespace("site-registration:import-scrape"));
const activeImports = new Map<string, {jobId: string; stop: (reason: string) => void}>();

export async function stopRegistrationImport(registrationId: string, reason: string): Promise<boolean> {
  const active = activeImports.get(registrationId);
  if (!active) {
    return false;
  } else {
    active.stop(reason);
    await cancelMigrationJobOnIntegrationWorker(active.jobId, reason).catch(error => debugLog("cancelling worker job %s failed: %s", active.jobId, error.message));
    return true;
  }
}

export function migrationTemplatePaths(migration: SiteMigrationConfig): string[] {
  return [...new Set([migration.templateFragmentId, ...(migration.parentPages || []).map(parent => parent.templateFragmentId)].filter(Boolean))];
}

export function templatePageForJob(page: PageContent): PageContent {
  return {path: page.path, rows: page.rows, migrationTemplate: page.migrationTemplate};
}

async function templatePages(paths: string[]): Promise<PageContent[]> {
  const pages = await pageContent.find({path: {$in: paths}}).lean<PageContent[]>().exec();
  return pages.map(templatePageForJob);
}

async function loadTemplatePages(migration: SiteMigrationConfig): Promise<PageContent[]> {
  return templatePages(migrationTemplatePaths(migration));
}

export async function registrationPhotoTemplates(): Promise<RegistrationPhotoTemplates> {
  const paths = [RegistrationMigrationTemplate.PHOTOS_INDEX, RegistrationMigrationTemplate.PHOTOS_YEAR];
  const pages = await templatePages(paths);
  const missing = paths.filter(path => !pages.some(page => page.path === path));
  if (missing.length) {
    throw new Error(`The migration template ${missing.join(" and ")} is missing. Add it under Admin → Content → Content Templates.`);
  } else {
    return {
      index: pages.find(page => page.path === RegistrationMigrationTemplate.PHOTOS_INDEX),
      year: pages.find(page => page.path === RegistrationMigrationTemplate.PHOTOS_YEAR)
    };
  }
}

export async function scrapeRegistrationSite(
  migration: SiteMigrationConfig,
  onProgress: (message: string) => void,
  registrationId?: string
): Promise<MigrationResult> {
  const jobId = randomUUID();
  const templatePages = await loadTemplatePages(migration);
  return new Promise<MigrationResult>((resolve, reject) => {
    const timer = setTimeout(() => {
      completeMigrationSession(jobId);
      reject(new Error("The integration worker did not finish importing the current website in time."));
    }, IMPORT_TIMEOUT_MS);
    const finish = (error: Error | null, result?: MigrationResult) => {
      clearTimeout(timer);
      completeMigrationSession(jobId);
      if (registrationId) {
        activeImports.delete(registrationId);
      }
      if (error) {
        reject(error);
      } else {
        resolve(result);
      }
    };
    if (registrationId) {
      activeImports.set(registrationId, {jobId, stop: reason => finish(new Error(reason))});
    }
    registerMigrationSession({
      jobId,
      siteIdentifier: migration.siteIdentifier,
      siteName: migration.name,
      startedAt: dateTimeNowAsValue(),
      onProgress: event => {
        onProgress(event.message);
      },
      onResult: body => {
        if (body.status === IntegrationWorkerResultStatus.Error) {
          finish(new Error(sanitiseRegistrationMessage(body.errorMessage || "The current website could not be imported.")));
        } else if (!body.result) {
          finish(new Error("The integration worker returned no import result."));
        } else {
          finish(null, body.result);
        }
      }
    });
    submitMigrationJobToIntegrationWorker(jobId, {...migration, templatePages, persistData: false}, false, false).catch(error => {
      finish(new Error(sanitiseRegistrationMessage(error instanceof Error ? error.message : String(error))));
    });
  });
}
