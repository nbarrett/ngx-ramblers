import { AnswersQuestions, Interaction, UsesAbilities } from "@serenity-js/core";
import { BrowseTheWeb } from "@serenity-js/web";
import debug from "debug";
import { envConfig } from "../../../../../env-config/env-config";

const debugLog = debug(envConfig.logNamespace("EnterRichText"));
debugLog.enabled = true;

export class EnterRichText extends Interaction {

  static into(fieldWrapperSelector: string, fieldLabel: string) {
    return {
      value: (html: string) => new EnterRichText(fieldWrapperSelector, fieldLabel, html)
    };
  }

  constructor(private readonly fieldWrapperSelector: string, fieldLabel: string, private readonly html: string) {
    super(`#actor enters ${fieldLabel}`);
  }

  async performAs(actor: UsesAbilities & AnswersQuestions): Promise<void> {
    debugLog("setting rich text on", this.fieldWrapperSelector, "->", this.html.slice(0, 80));
    const page = await BrowseTheWeb.as(actor).currentPage();
    const outcome = await page.executeScript((selector: string, html: string) => {
      type CkEditable = Element & { ckeditorInstance?: { setData: (value: string) => void; getData: () => string } };
      const applyWhenEditorReady = (attemptsLeft: number): Promise<{ok: boolean; reason?: string; applied?: string}> => {
        const editable = document.querySelector(`${selector} .ck-editor__editable`) as CkEditable | null;
        if (editable && editable.ckeditorInstance) {
          editable.ckeditorInstance.setData(html);
          return Promise.resolve({ok: true, applied: editable.ckeditorInstance.getData().slice(0, 60)});
        }
        if (attemptsLeft <= 0) {
          return Promise.resolve({ok: false, reason: `CKEditor instance did not become available for ${selector} within 20s`});
        }
        return new Promise(resolve => window.setTimeout(() => resolve(applyWhenEditorReady(attemptsLeft - 1)), 250));
      };
      return applyWhenEditorReady(80);
    }, this.fieldWrapperSelector, this.html) as {ok: boolean; reason?: string; applied?: string};

    if (!outcome.ok) {
      throw new Error(outcome.reason);
    }
    debugLog("rich text applied, editor now shows:", outcome.applied);
  }
}
