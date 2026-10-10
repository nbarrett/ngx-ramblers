import expect from "expect";
import { describe, it } from "mocha";
import type { Page } from "playwright-core";
import { OS_MAPS_CONFIRM_EXPORT_SELECTOR } from "../../../../../../projects/ngx-ramblers/src/app/models/os-maps-export.model";
import { clickVisibleOsMapsElementViaScript } from "./os-maps-clicks";

function pageWithVisibleConfirm(evaluateResult: boolean): Page {
  return {
    locator: (selector: string) => ({
      filter: (options: {visible: boolean}) => {
        expect(selector).toEqual(OS_MAPS_CONFIRM_EXPORT_SELECTOR);
        expect(options.visible).toEqual(true);
        return {
          first: () => ({
            waitFor: async (wait: {state: string}) => {
              expect(wait.state).toEqual("visible");
            }
          })
        };
      }
    }),
    evaluate: async (_script: unknown, selector: string) => {
      expect(selector).toEqual(OS_MAPS_CONFIRM_EXPORT_SELECTOR);
      return evaluateResult;
    }
  } as unknown as Page;
}

describe("clickVisibleOsMapsElementViaScript", () => {
  it("waits for a visible confirmation button then clicks it in the page", async () => {
    await expect(clickVisibleOsMapsElementViaScript(pageWithVisibleConfirm(true), OS_MAPS_CONFIRM_EXPORT_SELECTOR)).resolves.toBeUndefined();
  });

  it("throws when the script click finds no visible element", async () => {
    await expect(clickVisibleOsMapsElementViaScript(pageWithVisibleConfirm(false), OS_MAPS_CONFIRM_EXPORT_SELECTOR))
      .rejects.toThrow(`No visible element found to click via script: ${OS_MAPS_CONFIRM_EXPORT_SELECTOR}`);
  });
});
