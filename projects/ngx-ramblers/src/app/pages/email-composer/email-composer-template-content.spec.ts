import {describe, expect, it, vi} from "vitest";
import {EmailComposer} from "./email-composer";
import {defaultEmailComposerState} from "../../functions/email-composer";
import {ComposerFragmentKind} from "../../models/email-composer.model";
import {LocalTemplateContentResponse} from "../../models/mail.model";

describe("composer template content", () => {
  it("ignores a previous email type's template response after switching to an email without a template", async () => {
    const pending: {resolve: (value: LocalTemplateContentResponse) => void} = {resolve: null};
    const response = new Promise<LocalTemplateContentResponse>(resolve => pending.resolve = resolve);
    const instance = Object.create(EmailComposer.prototype);
    Object.assign(instance, {
      session: {state: defaultEmailComposerState()},
      mailService: {localTemplateContent: vi.fn(() => response)},
      logger: {error: vi.fn()},
      templateContentHtml: null,
      lastTemplateContentTemplateName: null
    });
    instance.session.state.notificationConfig = {id: "welcome", templateName: "welcome"};
    const loading = instance.refreshTemplateContent();
    instance.session.state.notificationConfig = {id: "newsletter"};
    await instance.refreshTemplateContent();
    pending.resolve({templateName: "welcome", htmlContent: "{{params.messageMergeFields.BODY_CONTENT_TOP}} Welcome {{params.messageMergeFields.BODY_CONTENT_BOTTOM}}"});
    await loading;
    expect(instance.templateContentHtml).toBeNull();
    expect(instance.templateContentFetching).toBe(false);
    expect(instance.session.state.fragmentOrder.some(fragment => fragment.kind === ComposerFragmentKind.TEMPLATE_CONTENT)).toBe(false);
  });
});
