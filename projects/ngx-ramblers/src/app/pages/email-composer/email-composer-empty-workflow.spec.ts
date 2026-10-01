import {describe, expect, it, vi} from "vitest";
import {EmailComposer} from "./email-composer";
import {defaultEmailComposerState} from "../../functions/email-composer";
import {BrandingMode, EmailComposerStepKey, RecipientMode} from "../../models/email-composer.model";
import {MemberSelection} from "../../models/mail.model";

describe("empty workflow steps", () => {
  function composer() {
    const state = defaultEmailComposerState();
    const instance = Object.create(EmailComposer.prototype);
    Object.assign(state, {
      brandingMode: BrandingMode.BRANDED,
      recipientMode: RecipientMode.SELECTED_MEMBERS,
      preFilterKey: MemberSelection.RECENTLY_ADDED,
      notificationConfig: {id: "first", defaultMemberSelection: MemberSelection.RECENTLY_ADDED, nextNotificationConfigId: "second"}
    });
    Object.assign(instance, {
      session: {state},
      stepperActiveTab: EmailComposerStepKey.RECIPIENTS,
      recipientSources: {mailMessagingConfig: {notificationConfigs: [{id: "second", subject: {text: "Next email"}}]}, workflowRemovesRecipients: () => true},
      continueToNextConfig: vi.fn()
    });
    return instance;
  }

  it("uses the existing continuation while leaving sending invalid", () => {
    const instance = composer();
    expect(instance.emptyWorkflowNextConfig()?.id).toBe("second");
    expect(instance.recipientsStepValid()).toBe(false);
    instance.goNext();
    expect(instance.continueToNextConfig).toHaveBeenCalledWith(instance.recipientSources.mailMessagingConfig.notificationConfigs[0]);
  });

  it("does not skip manually cleared audiences or a step with recipients", () => {
    const instance = composer();
    instance.session.state.preFilterKey = null;
    expect(instance.emptyWorkflowNextConfig()).toBe(null);
    instance.session.state.preFilterKey = MemberSelection.RECENTLY_ADDED;
    instance.session.state.selectedMemberIds = ["fictional-member"];
    expect(instance.emptyWorkflowNextConfig()).toBe(null);
  });

  it("rejects missing next configurations and self-links", () => {
    const instance = composer();
    instance.session.state.notificationConfig.nextNotificationConfigId = "missing";
    expect(instance.emptyWorkflowNextConfig()).toBe(null);
    instance.session.state.notificationConfig.nextNotificationConfigId = "first";
    instance.recipientSources.mailMessagingConfig.notificationConfigs = [{id: "first"}];
    expect(instance.emptyWorkflowNextConfig()).toBe(null);
  });
});
