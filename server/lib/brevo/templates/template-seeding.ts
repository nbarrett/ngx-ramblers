import debug from "debug";
import { envConfig } from "../../env-config/env-config";
import { createOrUpdateTemplate, findTemplateByName } from "./template-management";
import { localTemplateNames, readLocalTemplate } from "./local-template-reader";

const debugLog = debug(envConfig.logNamespace("brevo:template-seeding"));
const TEMPLATE_SUBJECT = "{{params.messageMergeFields.subject}}";

export interface SeedBrevoTemplatesResult {
  templateIdMap: Record<string, number>;
  templateNames: string[];
  totalTemplates: number;
  createdCount: number;
  updatedCount: number;
  skippedCount: number;
}

export async function seedBrevoTemplatesFromLocal(): Promise<SeedBrevoTemplatesResult> {
  const templateNames = localTemplateNames();
  const templateIdMap: Record<string, number> = {};
  let createdCount = 0;
  let updatedCount = 0;
  let skippedCount = 0;

  debugLog("Seeding Brevo templates from local", templateNames.length);

  for (const templateName of templateNames) {
    const htmlContent = readLocalTemplate(templateName);
    if (!htmlContent) {
      skippedCount += 1;
      continue;
    }
    const existing = await findTemplateByName(templateName);
    if (existing) {
      updatedCount += 1;
    } else {
      createdCount += 1;
    }
    const templateId = await createOrUpdateTemplate({
      templateName,
      htmlContent,
      subject: TEMPLATE_SUBJECT,
      isActive: true
    });
    templateIdMap[templateName] = templateId;
  }

  debugLog("Seeding complete", {createdCount, updatedCount, skippedCount});

  return {
    templateIdMap,
    templateNames,
    totalTemplates: templateNames.length,
    createdCount,
    updatedCount,
    skippedCount
  };
}
