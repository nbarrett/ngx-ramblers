import { Db, MongoClient } from "mongodb";
import createMigrationLogger from "../migrations-logger";
import { configuredBrevo } from "../../../brevo/brevo-config";
import { seedBrevoTemplatesFromLocal } from "../../../brevo/templates/template-seeding";
import { isObject, keys } from "es-toolkit/compat";
import { MigrationUpResult } from "../../../../../projects/ngx-ramblers/src/app/models/mongo-migration-model";

const debugLog = createMigrationLogger("sync-brevo-templates-body-content-placement");

export async function up(_db: Db, _client: MongoClient): Promise<MigrationUpResult | void> {
  let brevoConfig = null;
  try {
    brevoConfig = await configuredBrevo();
  } catch {
    brevoConfig = null;
  }

  if (!brevoConfig?.apiKey) {
    const reason = "No Brevo API key configured - skipping template sync for BODY_CONTENT_TOP/_BOTTOM placement";
    debugLog(reason);
    return { skipped: true, reason };
  }

  try {
    const seedResult = await seedBrevoTemplatesFromLocal();
    debugLog(`Found ${seedResult.totalTemplates} local templates: ${seedResult.templateNames.join(", ")}`);
    debugLog(`Template seeding completed: ${keys(seedResult.templateIdMap).length} templates available (created ${seedResult.createdCount}, updated ${seedResult.updatedCount}, skipped ${seedResult.skippedCount})`);
    debugLog("Workflow templates now expose BODY_CONTENT_TOP and BODY_CONTENT_BOTTOM placeholders. The composer can populate either based on whether user-supplied content sits above or below the template's standard text.");
  } catch (error) {
    const apiError = error as any;
    const statusCode = apiError?.statusCode || apiError?.response?.statusCode;
    const errorMessage = error instanceof Error ? error.message : String(error);
    const isAuthError = statusCode === 401 || statusCode === 403
      || /Brevo API error \[(401|403)]/.test(errorMessage);
    if (isAuthError) {
      const reason = `Brevo API returned ${statusCode || "401/403"} - skipping template sync (API key may be invalid or sender not verified): ${errorMessage}`;
      debugLog(reason);
      return { skipped: true, reason };
    }
    debugLog(`Migration failed with error: ${error}`);
    if (error instanceof Error) {
      debugLog(`Error message: ${error.message}`);
      debugLog(`Error stack: ${error.stack}`);
    }
    if (isObject(error)) {
      debugLog(`Error details: ${JSON.stringify(error, null, 2)}`);
    }
    const apiErrorMessage = apiError?.body?.message || apiError?.response?.body?.message;
    const apiErrorCode = apiError?.body?.code || apiError?.response?.body?.code;
    const enhancedMessage = apiErrorMessage
      ? `${errorMessage}: [${statusCode}] ${apiErrorCode} - ${apiErrorMessage}`
      : errorMessage;
    throw new Error(enhancedMessage);
  }
}

export async function down(_db: Db, _client: MongoClient) {
  debugLog("Down migration not implemented - previous template content cannot be reliably restored from Brevo");
}
