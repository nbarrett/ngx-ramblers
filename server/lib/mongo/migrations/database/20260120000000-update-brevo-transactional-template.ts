import { Db, MongoClient } from "mongodb";
import { readFileSync } from "fs";
import createMigrationLogger from "../migrations-logger";
import { createOrUpdateTemplate } from "../../../brevo/templates/template-management";
import { configuredBrevo } from "../../../brevo/brevo-config";
import { localTemplatePath } from "../../../brevo/templates/local-template-reader";

const debugLog = createMigrationLogger("update-brevo-transactional-template");
const TEMPLATE_NAME = "fully-automated-text-body";
const TEMPLATE_SUBJECT = "{{params.messageMergeFields.subject}}";

function templateHtmlPath(): string {
  return localTemplatePath(TEMPLATE_NAME);
}

function readTemplateHtml(): string {
  const templatePath = templateHtmlPath();
  debugLog(`Reading template from ${templatePath}`);
  return readFileSync(templatePath, "utf-8");
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
      const htmlContent = readTemplateHtml();
      debugLog(`Template HTML loaded, length: ${htmlContent.length} characters`);

      const templateId = await createOrUpdateTemplate({
        templateName: TEMPLATE_NAME,
        htmlContent,
        subject: TEMPLATE_SUBJECT,
        isActive: true
      });

      debugLog(`Template "${TEMPLATE_NAME}" created/updated with ID: ${templateId}`);
      debugLog("Migration completed successfully");
    } catch (error) {
      debugLog(`Migration failed with error: ${error}`);
      if (error instanceof Error) {
        debugLog(`Error message: ${error.message}`);
        debugLog(`Error stack: ${error.stack}`);
      }
      if (typeof error === "object" && error !== null) {
        debugLog(`Error details: ${JSON.stringify(error, null, 2)}`);
      }
      const apiError = error as any;
      const apiErrorMessage = apiError?.body?.message || apiError?.response?.body?.message;
      const apiErrorCode = apiError?.body?.code || apiError?.response?.body?.code;
      const statusCode = apiError?.statusCode || apiError?.response?.statusCode;
      const enhancedMessage = apiErrorMessage
        ? `${error instanceof Error ? error.message : "Error"}: [${statusCode}] ${apiErrorCode} - ${apiErrorMessage}`
        : (error instanceof Error ? error.message : String(error));
      throw new Error(enhancedMessage);
    }
  } else {
    debugLog("No Brevo API key configured, skipping migration");
  }
}

export async function down(db: Db, client: MongoClient) {
  debugLog("Down migration not implemented - template content cannot be automatically reverted");
}
