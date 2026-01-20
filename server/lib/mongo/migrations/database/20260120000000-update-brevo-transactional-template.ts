import { Db, MongoClient } from "mongodb";
import { readFileSync } from "fs";
import createMigrationLogger from "../migrations-logger";
import { createOrUpdateTemplate } from "../../../brevo/templates/template-management";
import { configuredBrevo } from "../../../brevo/brevo-config";
import { resolveClientPath } from "../../../shared/path-utils";

const debugLog = createMigrationLogger("update-brevo-transactional-template");
const TEMPLATE_NAME = "fully-automated-text-body";
const TEMPLATE_SUBJECT = "{{params.messageMergeFields.subject}}";

function templateHtmlPath(): string {
  return resolveClientPath(`projects/ngx-ramblers/src/brevo/templates/${TEMPLATE_NAME}.html`);
}

function readTemplateHtml(): string {
  const templatePath = templateHtmlPath();
  debugLog(`Reading template from ${templatePath}`);
  return readFileSync(templatePath, "utf-8");
}

export async function up(db: Db, client: MongoClient) {
  const brevoConfig = await configuredBrevo();

  if (!brevoConfig?.apiKey) {
    debugLog("No Brevo API key configured, skipping migration");
    return;
  }

  const htmlContent = readTemplateHtml();
  const templateId = await createOrUpdateTemplate({
    templateName: TEMPLATE_NAME,
    htmlContent,
    subject: TEMPLATE_SUBJECT,
    isActive: true
  });

  debugLog(`Template "${TEMPLATE_NAME}" created/updated with ID: ${templateId}`);
  debugLog("Migration completed successfully");
}

export async function down(db: Db, client: MongoClient) {
  debugLog("Down migration not implemented - template content cannot be automatically reverted");
}
