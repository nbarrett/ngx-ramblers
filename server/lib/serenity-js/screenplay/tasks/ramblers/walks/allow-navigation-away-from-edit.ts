import { AnswersQuestions, Interaction, UsesAbilities } from "@serenity-js/core";
import { BrowseTheWeb } from "@serenity-js/web";
import debug from "debug";
import { envConfig } from "../../../../../env-config/env-config";

const debugLog = debug(envConfig.logNamespace("AllowNavigationAwayFromEdit"));
debugLog.enabled = true;

interface NativeDialog {
  type(): string;
  accept(promptText?: string): Promise<void>;
  dismiss(): Promise<void>;
}

interface NativePage {
  on(event: "dialog", handler: (dialog: NativeDialog) => void): void;
  removeAllListeners(event: "dialog"): void;
}

export class AllowNavigationAwayFromEdit extends Interaction {

  static now(): AllowNavigationAwayFromEdit {
    return new AllowNavigationAwayFromEdit();
  }

  constructor() {
    super("#actor disables the Walks Manager unsaved-changes guard");
  }

  async performAs(actor: UsesAbilities & AnswersQuestions): Promise<void> {
    const page = await BrowseTheWeb.as(actor).currentPage();
    const nativePage = await (page as unknown as { nativePage(): Promise<NativePage> }).nativePage();
    nativePage.removeAllListeners("dialog");
    nativePage.on("dialog", (dialog: NativeDialog) => {
      debugLog("auto-accepting", dialog.type(), "dialog to allow navigation");
      dialog.accept().catch(() => undefined);
    });
    await page.executeScript(() => {
      const globalWindow = window as unknown as {
        onbeforeunload: unknown;
        addEventListener: (type: string, listener: unknown, options?: unknown) => void;
      };
      try {
        Object.defineProperty(globalWindow, "onbeforeunload", {configurable: true, get: () => null, set: () => undefined});
      } catch {
        globalWindow.onbeforeunload = null;
      }
      const originalAddEventListener = globalWindow.addEventListener.bind(globalWindow);
      globalWindow.addEventListener = (type: string, listener: unknown, options?: unknown) => {
        if (type === "beforeunload") {
          return;
        }
        return originalAddEventListener(type, listener, options);
      };
    });
  }
}
