import { describe, expect, it } from "vitest";
import { EmailBodyEditorComponent } from "./email-body-editor";
import { EMAIL_COMPOSER_BODY_PLACEHOLDER, EmailTemplateName, NotificationConfig } from "../../../../models/mail.model";

describe("built-in process email content", () => {
  async function editor(isBuiltInProcess: boolean, body: string | null) {
    const context = {
      notificationConfig: {body} as NotificationConfig,
      isBuiltInProcess,
      isAutomaticallyGenerated: false,
      ready: false,
      isPlaceholderOrEmpty: EmailBodyEditorComponent.prototype["isPlaceholderOrEmpty"],
      processTemplate: EmailBodyEditorComponent.prototype["processTemplate"],
      applyGeneratedContentFlag: EmailBodyEditorComponent.prototype["applyGeneratedContentFlag"]
    };
    await EmailBodyEditorComponent.prototype["ensureBody"].call(context);
    return context;
  }

  it("shows generated content guidance without requiring a template for a built-in process", async () => {
    const state = await editor(true, null);
    expect(state.isAutomaticallyGenerated).toBe(true);
    expect(state.ready).toBe(true);
  });

  it("recognises the generated body placeholder for a built-in process", async () => {
    expect((await editor(true, EMAIL_COMPOSER_BODY_PLACEHOLDER)).isAutomaticallyGenerated).toBe(true);
  });

  it("keeps manually written content editable", async () => {
    expect((await editor(false, null)).isAutomaticallyGenerated).toBe(false);
    expect((await editor(true, "Hello Alex")).isAutomaticallyGenerated).toBe(false);
  });

  it("treats a process template as generated even when stored body is a written letter", () => {
    const notificationConfig = {
      body: "We've noticed that the Ramblers membership expiry date we have in our records for you has now passed",
      templateName: EmailTemplateName.FULLY_AUTOMATED_TEXT_BODY
    } as NotificationConfig;
    const context = {
      notificationConfig,
      isBuiltInProcess: true,
      isAutomaticallyGenerated: false,
      isPlaceholderOrEmpty: EmailBodyEditorComponent.prototype["isPlaceholderOrEmpty"],
      processTemplate: EmailBodyEditorComponent.prototype["processTemplate"],
      applyGeneratedContentFlag: EmailBodyEditorComponent.prototype["applyGeneratedContentFlag"]
    };
    EmailBodyEditorComponent.prototype["applyGeneratedContentFlag"].call(context);
    expect(context.isAutomaticallyGenerated).toBe(true);
    EmailBodyEditorComponent.prototype.onBodyChange.call({
      ...context,
      isComposerDriven: EmailBodyEditorComponent.prototype.isComposerDriven,
      recalculateUnusedImageOverrides() {
      },
      contentChange: {emit() {}}
    }, "leaked editor markdown");
    expect(notificationConfig.body).toContain("membership expiry");
    expect(notificationConfig.body).not.toContain("leaked editor markdown");
  });

  it("does not write a previous letter onto a composer-driven newsletter", () => {
    const notificationConfig = {
      body: EMAIL_COMPOSER_BODY_PLACEHOLDER,
      templateName: EmailTemplateName.FULLY_AUTOMATED_TEXT_BODY
    } as NotificationConfig;
    EmailBodyEditorComponent.prototype.onBodyChange.call({
      notificationConfig,
      isAutomaticallyGenerated: false,
      isComposerDriven: EmailBodyEditorComponent.prototype.isComposerDriven,
      recalculateUnusedImageOverrides() {
      },
      contentChange: {emit() {}}
    }, "Welcome to the group leaked markdown");
    expect(notificationConfig.body).toEqual(EMAIL_COMPOSER_BODY_PLACEHOLDER);
  });
});
