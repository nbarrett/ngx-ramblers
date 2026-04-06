import { Db, MongoClient } from "mongodb";
import createMigrationLogger from "../migrations-logger";
import { configuredBrevo } from "../../../brevo/brevo-config";
import { seedBrevoTemplatesFromLocal } from "../../../brevo/templates/template-seeding";
import { archiveTemplate, backupTemplateName, listTemplates } from "../../../brevo/templates/template-management";
import { keys } from "es-toolkit/compat";
import { MigrationUpResult } from "../../../../../projects/ngx-ramblers/src/app/models/mongo-migration-model";
import { NOTIFICATION_CONFIG_COLLECTION } from "../shared/collection-names";
import { entries } from "../../../../../projects/ngx-ramblers/src/app/functions/object-utils";

const debugLog = createMigrationLogger("apply-ramblers-aligned-email-templates");

async function reconcileTemplateReferences(db: Db, templateIdMap: Record<string, number>): Promise<void> {
  const collection = db.collection(NOTIFICATION_CONFIG_COLLECTION);
  const templates = (await listTemplates()).templates;

  for (const [templateName, canonicalTemplateId] of entries(templateIdMap)) {
    const backupPrefix = backupTemplateName(templateName);
    const staleTemplates = templates.filter(template => template.id !== canonicalTemplateId && (
      template.name === templateName
      || template.name === backupPrefix
      || template.name.startsWith(`${backupPrefix}-`)
    ));

    const staleTemplateIds = staleTemplates.map(template => template.id);
    if (staleTemplateIds.length > 0) {
      const result = await collection.updateMany(
        {templateId: {$in: staleTemplateIds}},
        {$set: {templateId: canonicalTemplateId}}
      );
      debugLog(`Rewired ${result.modifiedCount} notification configs from stale template IDs [${staleTemplateIds.join(", ")}] to canonical ID ${canonicalTemplateId} for "${templateName}"`);
    }

    const duplicateLiveTemplates = staleTemplates.filter(template => template.name === templateName);
    for (const duplicateLiveTemplate of duplicateLiveTemplates) {
      await archiveTemplate(duplicateLiveTemplate);
      debugLog(`Archived duplicate Brevo template "${templateName}" with stale ID ${duplicateLiveTemplate.id}`);
    }
  }
}

export async function up(db: Db, client: MongoClient): Promise<MigrationUpResult | void> {
  let brevoConfig = null;
  try {
    brevoConfig = await configuredBrevo();
  } catch {
    brevoConfig = null;
  }

  if (brevoConfig?.apiKey) {
    try {
      const seedResult = await seedBrevoTemplatesFromLocal();
      debugLog(`Reseeded ${seedResult.totalTemplates} Ramblers-aligned templates: ${seedResult.templateNames.join(", ")}`);
      debugLog(`Template seeding completed: ${keys(seedResult.templateIdMap).length} templates available (created ${seedResult.createdCount}, updated ${seedResult.updatedCount}, skipped ${seedResult.skippedCount})`);
      await reconcileTemplateReferences(db, seedResult.templateIdMap);
    } catch (error) {
      const apiError = error as any;
      const statusCode = apiError?.statusCode || apiError?.response?.statusCode;
      const errorMessage = error instanceof Error ? error.message : String(error);
      const isAuthError = statusCode === 401 || statusCode === 403
        || /Brevo API error \[(401|403)]/.test(errorMessage);
      if (isAuthError) {
        const reason = `Brevo API returned ${statusCode || "401/403"} — skipping template reseed (API key may be invalid or sender not verified): ${errorMessage}`;
        debugLog(reason);
        return {skipped: true, reason};
      } else {
        debugLog(`Migration failed with error: ${error}`);
        const apiErrorMessage = apiError?.body?.message || apiError?.response?.body?.message;
        const apiErrorCode = apiError?.body?.code || apiError?.response?.body?.code;
        const enhancedMessage = apiErrorMessage
          ? `${errorMessage}: [${statusCode}] ${apiErrorCode} - ${apiErrorMessage}`
          : errorMessage;
        throw new Error(enhancedMessage);
      }
    }
  } else {
    const reason = "No Brevo API key configured — skipping Ramblers-aligned template reseed";
    debugLog(reason);
    return {skipped: true, reason};
  }
}

export async function down(db: Db, client: MongoClient) {
  debugLog("Down migration not implemented - template content cannot be automatically reverted");
}
