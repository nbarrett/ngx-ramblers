import { Interaction, UsesAbilities } from "@serenity-js/core/lib/screenplay";
import { BrowseTheWeb } from "@serenity-js/web";
import type { PlaywrightPage } from "@serenity-js/playwright";
import type { Page as NativePage } from "playwright-core";
import debug from "debug";
import { envConfig } from "../../../../../env-config/env-config";
import { walkEditPageNavigatedDuringScript } from "../../../questions/ramblers/walk-edit-form";
import { snapMetricImperialNumberInputsScript } from "./walk-edit-number-fields";

const debugLog = debug(envConfig.logNamespace("PublishWalkEditForm"));
debugLog.enabled = true;

export const WALK_EDIT_PUBLISH_SUBMIT_SELECTOR = "#save_publish_action";
export const WALK_EDIT_PUBLISH_LABEL_SELECTOR = "#publish";
export const WALK_EDIT_FORM_SELECTOR = "#node-walk-walk-details-form";

export interface WalkEditPublishAttempt {
  foundSubmit: boolean;
  foundForm: boolean;
  submitted: boolean;
  method: string;
  invalidFields: string[];
}

export function prepareWalkEditFormForPublish(documentRef: Document, submitSelector: string, formSelector: string): WalkEditPublishAttempt {
  const submitter = documentRef.querySelector(submitSelector) as HTMLInputElement | null;
  const form = submitter?.form || documentRef.querySelector(formSelector) as HTMLFormElement | null;
  const invalidFields = form
    ? Array.from(form.querySelectorAll(":invalid")).map(element => element.id || element.getAttribute("name") || element.tagName)
    : [];
  if (form) {
    form.noValidate = true;
  }
  if (submitter) {
    submitter.disabled = false;
  }
  return {
    foundSubmit: !!submitter,
    foundForm: !!form,
    submitted: false,
    method: "prepared",
    invalidFields
  };
}

export function forceSubmitWalkEditPublish(
  documentRef: Document,
  windowRef: {ngxSaveSubmitted?: boolean},
  submitSelector: string,
  formSelector: string): WalkEditPublishAttempt {
  const submitter = documentRef.querySelector(submitSelector) as HTMLInputElement | null;
  const form = submitter?.form || documentRef.querySelector(formSelector) as HTMLFormElement | null;
  if (!form) {
    return {foundSubmit: !!submitter, foundForm: false, submitted: false, method: "missing-form", invalidFields: []};
  } else {
    const extra = form.querySelector("input[data-ngx-publish='true']") as HTMLInputElement
      || form.appendChild(Object.assign(documentRef.createElement("input"), {
        type: "hidden",
        name: "save_publish_action",
        value: "Publish"
      }));
    extra.setAttribute("data-ngx-publish", "true");
    windowRef.ngxSaveSubmitted = true;
    form.submit();
    return {foundSubmit: !!submitter, foundForm: true, submitted: true, method: "form-submit", invalidFields: []};
  }
}

export class PublishWalkEditForm extends Interaction {

  static now() {
    return new PublishWalkEditForm();
  }

  constructor() {
    super("#actor publishes the walk");
  }

  async performAs(actor: UsesAbilities): Promise<void> {
    const currentPage = await BrowseTheWeb.as(actor).currentPage() as unknown as PlaywrightPage;
    const native: NativePage = await currentPage.nativePage();
    const selectors = {
      submit: WALK_EDIT_PUBLISH_SUBMIT_SELECTOR,
      form: WALK_EDIT_FORM_SELECTOR
    };
    const snapped = await native.evaluate(snapMetricImperialNumberInputsScript()) as {id: string; value: string}[];
    debugLog("snapped number fields", JSON.stringify(snapped));
    const prepared = await native.evaluate(`(${prepareWalkEditFormForPublish.toString()})(document, ${JSON.stringify(selectors.submit)}, ${JSON.stringify(selectors.form)})`) as WalkEditPublishAttempt;
    debugLog("prepare", JSON.stringify(prepared));
    try {
      await this.clickPublishControl(native, WALK_EDIT_PUBLISH_LABEL_SELECTOR, false);
      if (!await this.publishSubmitted(native) && await this.publishFormPresent(native)) {
        await this.clickPublishControl(native, WALK_EDIT_PUBLISH_SUBMIT_SELECTOR, true);
      }
      if (!await this.publishSubmitted(native) && await this.publishFormPresent(native)) {
        const forced = await native.evaluate(`(${forceSubmitWalkEditPublish.toString()})(document, window, ${JSON.stringify(selectors.submit)}, ${JSON.stringify(selectors.form)})`) as WalkEditPublishAttempt;
        debugLog("force submit", JSON.stringify(forced));
      }
    } catch (error) {
      if (walkEditPageNavigatedDuringScript(error)) {
        debugLog("publish caused navigation");
      } else {
        throw error;
      }
    }
  }

  private async clickPublishControl(native: NativePage, selector: string, force: boolean): Promise<void> {
    const locator = native.locator(selector).first();
    const present = await locator.count() > 0;
    if (force && present) {
      await locator.click({force: true, noWaitAfter: true});
      debugLog("clicked", selector, "force:", true);
    } else if (!force && present && await locator.isVisible()) {
      await locator.click({noWaitAfter: true});
      debugLog("clicked", selector, "force:", false);
    }
  }

  private publishSubmitted(native: NativePage): Promise<boolean> {
    return native.evaluate(() => (window as unknown as {ngxSaveSubmitted?: boolean}).ngxSaveSubmitted === true);
  }

  private async publishFormPresent(native: NativePage): Promise<boolean> {
    return (await native.locator(WALK_EDIT_FORM_SELECTOR).count()) > 0;
  }
}
