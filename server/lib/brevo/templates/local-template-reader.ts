import { readFileSync, existsSync, readdirSync } from "fs";
import debug from "debug";
import { envConfig } from "../../env-config/env-config";
import { resolveClientPath } from "../../shared/path-utils";

const debugLog = debug(envConfig.logNamespace("brevo:local-template-reader"));

export const BREVO_TEMPLATES_DIR = "projects/ngx-ramblers/src/brevo/templates";

export function localTemplatePath(templateName: string): string {
  return resolveClientPath(`${BREVO_TEMPLATES_DIR}/${templateName}.html`);
}

export function readLocalTemplate(templateName: string): string | null {
  const templatePath = localTemplatePath(templateName);
  debugLog(`Attempting to read local template: ${templatePath}`);
  if (existsSync(templatePath)) {
    const content = readFileSync(templatePath, "utf-8");
    debugLog(`Local template found for "${templateName}", length: ${content.length}`);
    return content;
  }
  debugLog(`No local template found for "${templateName}"`);
  return null;
}

export function localTemplateNames(): string[] {
  const dirPath = resolveClientPath(BREVO_TEMPLATES_DIR);
  if (!existsSync(dirPath)) {
    debugLog(`Templates directory not found: ${dirPath}`);
    return [];
  }
  return readdirSync(dirPath)
    .filter((file: string) => file.endsWith(".html"))
    .map((file: string) => file.replace(/\.html$/, ""));
}
