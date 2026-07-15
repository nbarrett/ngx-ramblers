import { AnswersQuestions, Interaction, UsesAbilities } from "@serenity-js/core";
import { BrowseTheWeb } from "@serenity-js/web";
import debug from "debug";
import { envConfig } from "../../../../../env-config/env-config";

const debugLog = debug(envConfig.logNamespace("SelectOptionViaScript"));
debugLog.enabled = true;

export class SelectOptionViaScript extends Interaction {

  static on(cssSelector: string, description?: string) {
    return {
      toValue: (value: string) => new SelectOptionViaScript(cssSelector, value, description)
    };
  }

  constructor(private readonly cssSelector: string, private readonly value: string, description?: string) {
    super(`#actor ${description || `selects "${value}" in ${cssSelector}`}`);
  }

  async performAs(actor: UsesAbilities & AnswersQuestions): Promise<void> {
    const page = await BrowseTheWeb.as(actor).currentPage();
    const outcome = await page.executeScript((selector: string, value: string) => {
      const element = document.querySelector(selector) as HTMLSelectElement | null;
      if (!element) {
        return {ok: false, reason: `no element for ${selector}`};
      }
      const hasOption = Array.from(element.options).some(option => option.value === value);
      if (!hasOption) {
        return {ok: false, reason: `no option "${value}" available in ${selector}`};
      }
      element.value = value;
      element.dispatchEvent(new Event("change", {bubbles: true}));
      return {ok: element.value === value, reason: element.value};
    }, this.cssSelector, this.value) as {ok: boolean; reason?: string};
    if (!outcome.ok) {
      throw new Error(`Could not select "${this.value}" in ${this.cssSelector}: ${outcome.reason}`);
    }
    debugLog("selected", this.value, "in", this.cssSelector, "via script");
  }
}
