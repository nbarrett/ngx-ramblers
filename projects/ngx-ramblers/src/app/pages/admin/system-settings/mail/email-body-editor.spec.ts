import { describe, expect, it } from "vitest";
import { EmailBodyEditorComponent } from "./email-body-editor";
import { EMAIL_COMPOSER_BODY_PLACEHOLDER, NotificationConfig } from "../../../../models/mail.model";

describe("built-in process email content", () => {
  async function editor(isBuiltInProcess: boolean, body: string | null) {
    const context = {
      notificationConfig: {body} as NotificationConfig,
      isBuiltInProcess,
      isAutomaticallyGenerated: false,
      ready: false,
      isPlaceholderOrEmpty: EmailBodyEditorComponent.prototype["isPlaceholderOrEmpty"]
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
});
