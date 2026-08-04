import debug from "debug";
import { envConfig } from "../../env-config/env-config";
import { createOrUpdateTemplate, findTemplateByName } from "./template-management";
import { localTemplateNames } from "./local-template-reader";
import { seedableTemplateHtml } from "../common/messages";
import { logBrevoError } from "../common/error-log";
import {
  SeedBrevoTemplatesResult,
  TemplateSeedFailure,
  TemplateSeedOutcome,
  TemplateSeedStatus
} from "../../../../projects/ngx-ramblers/src/app/models/mail.model";

const debugLog = debug(envConfig.logNamespace("brevo:template-seeding"));
const TEMPLATE_SUBJECT = "{{params.messageMergeFields.subject}}";

async function seedTemplate(templateName: string): Promise<TemplateSeedOutcome> {
  const htmlContent = seedableTemplateHtml(templateName);
  if (htmlContent) {
    const existing = await findTemplateByName(templateName);
    debugLog("Processing template", templateName);
    try {
      const templateId = await createOrUpdateTemplate({
        templateName,
        htmlContent,
        subject: TEMPLATE_SUBJECT,
        isActive: true
      });
      return {templateName, templateId, status: existing ? TemplateSeedStatus.UPDATED : TemplateSeedStatus.CREATED};
    } catch (error) {
      logBrevoError("brevo:template-seeding", error, {templateName});
      const message = error instanceof Error ? error.message : String(error);
      debugLog("Failed processing template", templateName, message);
      return {templateName, status: TemplateSeedStatus.FAILED, message};
    }
  } else {
    return {templateName, status: TemplateSeedStatus.SKIPPED};
  }
}

export async function seedBrevoTemplatesFromLocal(): Promise<SeedBrevoTemplatesResult> {
  const templateNames = localTemplateNames();
  debugLog("Seeding Brevo templates from local", templateNames.length);
  const outcomes: TemplateSeedOutcome[] = await templateNames.reduce<Promise<TemplateSeedOutcome[]>>(
    async (previousOutcomes, templateName) => [...await previousOutcomes, await seedTemplate(templateName)],
    Promise.resolve([])
  );
  const countOf = (status: TemplateSeedStatus): number => outcomes.filter(outcome => outcome.status === status).length;
  const failures: TemplateSeedFailure[] = outcomes
    .filter(outcome => outcome.status === TemplateSeedStatus.FAILED)
    .map(outcome => ({templateName: outcome.templateName, message: outcome.message}));
  const templateIdMap: Record<string, number> = Object.fromEntries(outcomes
    .filter(outcome => outcome.templateId)
    .map(outcome => [outcome.templateName, outcome.templateId]));
  const result: SeedBrevoTemplatesResult = {
    templateIdMap,
    templateNames,
    totalTemplates: templateNames.length,
    createdCount: countOf(TemplateSeedStatus.CREATED),
    updatedCount: countOf(TemplateSeedStatus.UPDATED),
    skippedCount: countOf(TemplateSeedStatus.SKIPPED),
    failedCount: failures.length,
    failures
  };
  debugLog("Seeding complete", result);
  return result;
}

export function templateSeedFailureSummary(failures: TemplateSeedFailure[]): string {
  return failures.map(failure => `${failure.templateName}: ${failure.message}`).join("; ");
}

export function templateSeedSummary(result: SeedBrevoTemplatesResult): string {
  const counts = `Created ${result.createdCount}, updated ${result.updatedCount}, skipped ${result.skippedCount}`;
  return result.failedCount === 0
    ? counts
    : `${counts}, failed ${result.failedCount}: ${templateSeedFailureSummary(result.failures)}`;
}
