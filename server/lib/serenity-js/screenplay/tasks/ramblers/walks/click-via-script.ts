import { AnswersQuestions, Interaction, UsesAbilities } from "@serenity-js/core";
import { BrowseTheWeb } from "@serenity-js/web";
import debug from "debug";
import { envConfig } from "../../../../../env-config/env-config";

const debugLog = debug(envConfig.logNamespace("ClickViaScript"));
debugLog.enabled = true;

export class ClickViaScript extends Interaction {

  static on(cssSelector: string, description?: string): ClickViaScript {
    return new ClickViaScript(cssSelector, description);
  }

  constructor(private readonly cssSelector: string, description?: string) {
    super(`#actor ${description || `clicks ${cssSelector}`}`);
  }

  async performAs(actor: UsesAbilities & AnswersQuestions): Promise<void> {
    const page = await BrowseTheWeb.as(actor).currentPage();
    const clicked = await page.executeScript((selector: string) => {
      const element = document.querySelector(selector) as HTMLElement | null;
      if (!element) {
        return false;
      }
      element.click();
      return true;
    }, this.cssSelector) as boolean;
    if (!clicked) {
      throw new Error(`No element found to click via script: ${this.cssSelector}`);
    }
    debugLog("clicked", this.cssSelector, "via script");
  }
}
