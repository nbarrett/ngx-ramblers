import { describe, expect, it, vi } from "vitest";
import { EmailComposer } from "./email-composer";
import { StoredValue } from "../../models/ui-actions";
import {
  AddresseeType,
  EmailComposerStepKey,
  RecipientMode,
  SendingChannel
} from "../../models/email-composer.model";
import { BrandingMode } from "../../models/mail.model";

describe("composer branding mode", () => {
  function composer(overrides: Record<string, unknown> = {}) {
    const instance = Object.create(EmailComposer.prototype);
    Object.assign(instance, {
      unbrandedListSendWarningDismissed: true,
      unbrandedSenderAlertDismissed: true,
      rememberBranding: true,
      stepperActiveTab: EmailComposerStepKey.RECIPIENTS,
      goToStepKey: vi.fn(),
      recipients: {recipientsPanelExpanded: false, ensureSelectedListIsOnTo: vi.fn()},
      uiActions: {saveValueFor: vi.fn()},
      session: {
        syncStateToUrl: vi.fn(),
        state: {
          brandingMode: BrandingMode.BRANDED,
          recipientMode: RecipientMode.ENTIRE_LIST,
          sendingChannel: SendingChannel.CAMPAIGN,
          selectedListId: 13,
          narrowListId: null,
          preFilterKey: null,
          selectedMemberIds: [42],
          externalRecipients: [{email: "alex.reed@example.com", name: "Alex Reed"}],
          ccRecipients: [{email: "chair@group.example.org.uk"}],
          bccRecipients: [],
          signoffRoles: ["chair"],
          notificationConfig: {id: "newsletter"},
          bannerId: "banner-1",
          addresseeType: AddresseeType.FIRST_NAME,
          introMarkdown: "Hosting disruption note",
          subject: "Website hosting disruption on 16 October"
        }
      },
      ...overrides
    });
    return instance;
  }

  it("switching to unbranded keeps recipients, list, template and copy", () => {
    const instance = composer();
    instance.setBrandingMode(BrandingMode.UNBRANDED);
    expect(instance.session.state.brandingMode).toEqual(BrandingMode.UNBRANDED);
    expect(instance.session.state.recipientMode).toEqual(RecipientMode.ENTIRE_LIST);
    expect(instance.session.state.sendingChannel).toEqual(SendingChannel.CAMPAIGN);
    expect(instance.session.state.selectedListId).toEqual(13);
    expect(instance.session.state.selectedMemberIds).toEqual([42]);
    expect(instance.session.state.externalRecipients).toEqual([{email: "alex.reed@example.com", name: "Alex Reed"}]);
    expect(instance.session.state.ccRecipients).toEqual([{email: "chair@group.example.org.uk"}]);
    expect(instance.session.state.signoffRoles).toEqual(["chair"]);
    expect(instance.session.state.notificationConfig).toEqual({id: "newsletter"});
    expect(instance.session.state.bannerId).toEqual("banner-1");
    expect(instance.session.state.addresseeType).toEqual(AddresseeType.FIRST_NAME);
    expect(instance.session.state.introMarkdown).toEqual("Hosting disruption note");
    expect(instance.session.state.subject).toEqual("Website hosting disruption on 16 October");
    expect(instance.session.syncStateToUrl).toHaveBeenCalledWith({[StoredValue.BRANDING]: BrandingMode.UNBRANDED});
    expect(instance.uiActions.saveValueFor).toHaveBeenCalledWith(StoredValue.BRANDING, BrandingMode.UNBRANDED);
  });

  it("switching back to branded keeps the same recipients and copy", () => {
    const instance = composer();
    instance.setBrandingMode(BrandingMode.UNBRANDED);
    instance.setBrandingMode(BrandingMode.BRANDED);
    expect(instance.session.state.brandingMode).toEqual(BrandingMode.BRANDED);
    expect(instance.session.state.selectedListId).toEqual(13);
    expect(instance.session.state.externalRecipients).toEqual([{email: "alex.reed@example.com", name: "Alex Reed"}]);
    expect(instance.session.state.introMarkdown).toEqual("Hosting disruption note");
    expect(instance.session.syncStateToUrl).toHaveBeenCalledWith({[StoredValue.BRANDING]: BrandingMode.BRANDED});
  });
});
