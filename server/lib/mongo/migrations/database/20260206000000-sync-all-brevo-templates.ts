import { Db, MongoClient } from "mongodb";
import createMigrationLogger from "../migrations-logger";
import { configuredBrevo } from "../../../brevo/brevo-config";
import { seedBrevoTemplatesFromLocal } from "../../../brevo/templates/template-seeding";
import { isObject, keys } from "es-toolkit/compat";

const debugLog = createMigrationLogger("sync-all-brevo-templates");
const NOTIFICATION_CONFIGS_COLLECTION = "notificationConfigs";

const TEMPLATE_TO_SUBJECTS: Record<string, string[]> = {
  "welcome-to-the-group": ["Welcome to The Group"],
  "website-and-login-details": [
    "Website Password Reset Instructions",
    "Forgotten Password Reset",
    "Your NGX-Ramblers Login"
  ]
};

const DEFAULT_TEMPLATE = "fully-automated-text-body";

async function autoMatchTemplatesToNotificationConfigs(db: Db, templateIdMap: Record<string, number>) {
  const collection = db.collection(NOTIFICATION_CONFIGS_COLLECTION);
  const unmatchedConfigs = await collection.find({
    $or: [{templateId: null}, {templateId: {$exists: false}}]
  }).toArray();

  debugLog(`Found ${unmatchedConfigs.length} notification configs without template IDs`);

  let matchedCount = 0;
  for (const config of unmatchedConfigs) {
    const subjectText = config.subject?.text;
    if (!subjectText) continue;

    let matchedTemplateName: string | null = null;
    for (const [templateName, subjects] of Object.entries(TEMPLATE_TO_SUBJECTS)) {
      if (subjects.includes(subjectText)) {
        matchedTemplateName = templateName;
        break;
      }
    }

    if (!matchedTemplateName && templateIdMap[DEFAULT_TEMPLATE]) {
      matchedTemplateName = DEFAULT_TEMPLATE;
    }

    if (matchedTemplateName && templateIdMap[matchedTemplateName]) {
      const templateId = templateIdMap[matchedTemplateName];
      await collection.updateOne(
        {_id: config._id},
        {$set: {templateId}}
      );
      debugLog(`Matched "${subjectText}" → template "${matchedTemplateName}" (ID: ${templateId})`);
      matchedCount++;
    } else {
      debugLog(`No template match for "${subjectText}"`);
    }
  }

  debugLog(`Auto-matched ${matchedCount} of ${unmatchedConfigs.length} notification configs`);
}

export async function up(db: Db, client: MongoClient) {
  let brevoConfig = null;
  try {
    brevoConfig = await configuredBrevo();
  } catch {
    brevoConfig = null;
  }

  if (brevoConfig?.apiKey) {
    try {
      const seedResult = await seedBrevoTemplatesFromLocal();
      debugLog(`Found ${seedResult.totalTemplates} local templates: ${seedResult.templateNames.join(", ")}`);
      debugLog(`Template seeding completed: ${keys(seedResult.templateIdMap).length} templates available (created ${seedResult.createdCount}, updated ${seedResult.updatedCount}, skipped ${seedResult.skippedCount})`);

      await autoMatchTemplatesToNotificationConfigs(db, seedResult.templateIdMap);
    } catch (error) {
      const apiError = error as any;
      const statusCode = apiError?.statusCode || apiError?.response?.statusCode;
      if (statusCode === 401) {
        debugLog("Brevo API key is invalid (401 unauthorised) — skipping migration");
      } else {
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
          ? `${error instanceof Error ? error.message : "Error"}: [${statusCode}] ${apiErrorCode} - ${apiErrorMessage}`
          : (error instanceof Error ? error.message : String(error));
        throw new Error(enhancedMessage);
      }
    }
  } else {
    debugLog("No Brevo API key configured, skipping migration");
  }
}

export async function down(db: Db, client: MongoClient) {
  debugLog("Down migration not implemented - template content cannot be automatically reverted");
}
