import { describe, expect, it, vi } from "vitest";
import { EmailComposer } from "./email-composer";
import { StoredValue } from "../../models/ui-actions";
import {
  AddresseeType,
  ComposerFragmentKind,
  EmailCompositionKind,
  EmailComposerStepKey,
  RecipientMode,
  SendingChannel
} from "../../models/email-composer.model";
import { BrandingMode, MergeFieldParamsGroup } from "../../models/mail.model";

describe("composer branding mode", () => {
  function composer(overrides: Record<string, unknown> = {}) {
    const instance = Object.create(EmailComposer.prototype);
    Object.assign(instance, {
      unbrandedListSendWarningDismissed: true,
      unbrandedSenderAlertDismissed: true,
      rememberBranding: true,
      stepperActiveTab: EmailComposerStepKey.RECIPIENTS,
      goToStepKey: vi.fn(),
      fragmentEditor: {ensureUnbrandedMessage: vi.fn()},
      recipients: {recipientsPanelExpanded: false, ensureSelectedListIsOnTo: vi.fn(), syncRecipientAddressMode: vi.fn(), clearRecipientSelection: vi.fn()},
      recipientResolution: {committeeOnlyAudience: () => false},
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

  it.each([BrandingMode.UNBRANDED, BrandingMode.BRANDED])("renders deliberate sign-off text and applies automatic names only in branded mode: %s", mode => {
    const signoffNames = vi.fn(() => "<p>Alex Reed, Chair</p>");
    const instance = composer({
      fragmentEditor: {fragmentsForRender: () => [{kind: ComposerFragmentKind.SIGNOFF, id: "signoff"}]},
      validSignoffRolesFor: (roles: string[]) => roles,
      rendering: {
        markdownToHtml: (text: string) => `<p>${text}</p>`,
        joinSectionsWithPerSectionDividers: (sections: {content: string}[]) => sections.map(section => section.content).join("\n")
      },
      mailMessagingService: {signoffNames},
      salutationHtml: () => ""
    });
    instance.session.state.brandingMode = mode;
    instance.session.state.signoffTextMarkdown = "Regards, Casey";
    const body = instance.composedBodyParts().combined;
    expect(body).toContain("Regards, Casey");
    expect(instance.session.state.signoffRoles).toEqual(["chair"]);
    if (mode === BrandingMode.UNBRANDED) {
      expect(body).not.toContain("Alex Reed");
      expect(signoffNames).not.toHaveBeenCalled();
    } else {
      expect(body).toContain("Alex Reed");
      expect(signoffNames).toHaveBeenCalledWith(["chair"]);
    }
  });

  it("restoring unbranded mode preserves the saved recipients, list, template and copy", () => {
    const instance = composer();
    instance.setBrandingMode(BrandingMode.UNBRANDED, true);
    expect(instance.session.state.brandingMode).toEqual(BrandingMode.UNBRANDED);
    expect(instance.fragmentEditor.ensureUnbrandedMessage).toHaveBeenCalledWith(instance.session.state);
    expect(instance.recipients.syncRecipientAddressMode).toHaveBeenCalledOnce();
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
    expect(instance.session.syncStateToUrl).toHaveBeenCalledWith({[StoredValue.BRANDING]: BrandingMode.UNBRANDED, [StoredValue.CONFIG_ID]: null});
    expect(instance.uiActions.saveValueFor).toHaveBeenCalledWith(StoredValue.BRANDING, BrandingMode.UNBRANDED);
  });

  it("clears the whole recipient selection when switching a non-committee audience to unbranded", () => {
    const instance = composer();
    instance.setBrandingMode(BrandingMode.UNBRANDED);
    expect(instance.recipients.clearRecipientSelection).toHaveBeenCalledOnce();
    expect(instance.recipients.ensureSelectedListIsOnTo).not.toHaveBeenCalled();
    expect(instance.session.syncStateToUrl).toHaveBeenLastCalledWith({
      [StoredValue.BRANDING]: BrandingMode.UNBRANDED,
      [StoredValue.CONFIG_ID]: null,
      [StoredValue.EMAIL_TYPE]: "selected-members",
      [StoredValue.LIST_ID]: null,
      [StoredValue.PRE_FILTER]: null
    });
    expect(instance.session.state.subject).toBe("Website hosting disruption on 16 October");
  });

  it("keeps the selection when every recipient is a committee member", () => {
    const instance = composer({recipientResolution: {committeeOnlyAudience: () => true}});
    instance.setBrandingMode(BrandingMode.UNBRANDED);
    expect(instance.recipients.clearRecipientSelection).not.toHaveBeenCalled();
    expect(instance.recipients.ensureSelectedListIsOnTo).toHaveBeenCalledOnce();
  });

  it("does not clear recipients when unbranded mode is applied again", () => {
    const instance = composer();
    instance.session.state.brandingMode = BrandingMode.UNBRANDED;
    instance.setBrandingMode(BrandingMode.UNBRANDED);
    expect(instance.recipients.clearRecipientSelection).not.toHaveBeenCalled();
  });

  it("removes the configuration subject when switching to unbranded", () => {
    const instance = composer({eventsStepOmitted: () => true, composeStepOmitted: () => false});
    instance.session.state.notificationConfig.subject = {text: "Newsletter"};
    instance.session.state.subject = "Newsletter";
    instance.setBrandingMode(BrandingMode.UNBRANDED);
    expect(instance.session.state.subject).toBe("");
    expect(instance.stepHint(EmailComposerStepKey.TEMPLATE)).toBe("Unbranded");
    expect(instance.visibleStepperSteps().find(step => step.key === EmailComposerStepKey.TEMPLATE)?.label).toBe("Sender");
  });

  it("does not show template-subject warnings for unbranded mail", () => {
    const instance = composer({drafting: {lastAppliedNewsletterSubject: null}});
    instance.session.state.brandingMode = BrandingMode.UNBRANDED;
    instance.session.state.notificationConfig.subject = {text: "Newsletter", placeholder: true};
    instance.session.state.subject = "";
    expect(instance.subjectUnchangedFromDefault()).toBe(false);
    instance.session.state.subject = "Newsletter";
    expect(instance.subjectUnchangedFromDefault()).toBe(false);
    instance.session.state.brandingMode = BrandingMode.BRANDED;
    expect(instance.subjectUnchangedFromDefault()).toBe(true);
  });

  it("switching back to branded keeps the committee recipients and copy", () => {
    const instance = composer({recipientResolution: {committeeOnlyAudience: () => true}});
    instance.setBrandingMode(BrandingMode.UNBRANDED);
    instance.setBrandingMode(BrandingMode.BRANDED);
    expect(instance.session.state.brandingMode).toEqual(BrandingMode.BRANDED);
    expect(instance.session.state.selectedListId).toEqual(13);
    expect(instance.session.state.externalRecipients).toEqual([{email: "alex.reed@example.com", name: "Alex Reed"}]);
    expect(instance.session.state.introMarkdown).toEqual("Hosting disruption note");
    expect(instance.session.syncStateToUrl).toHaveBeenCalledWith({[StoredValue.BRANDING]: BrandingMode.BRANDED});
  });

  it("ignores an inherited first-name salutation for unbranded mail while keeping it available in branded mode", () => {
    const instance = composer({composedBodyParts: () => ({top: "Hello everyone", bottom: "", combined: "Hello everyone"})});
    instance.session.state.brandingMode = BrandingMode.UNBRANDED;
    expect(instance.contentIsPersonalised()).toBe(false);
    expect(instance.addresseePlaceholder()).toBe("");
    instance.session.state.brandingMode = BrandingMode.BRANDED;
    expect(instance.contentIsPersonalised()).toBe(true);
    expect(instance.addresseePlaceholder()).toContain("FNAME");
  });

  it("ignores merge fields in unused branded sections when deciding how an unbranded message is sent", () => {
    const instance = composer({composedBodyParts: () => ({top: "Hello everyone", bottom: "", combined: "Hello everyone"})});
    instance.session.state.brandingMode = BrandingMode.UNBRANDED;
    instance.session.state.signoffTextMarkdown = `{{params.${MergeFieldParamsGroup.MEMBER}.FNAME}}`;
    expect(instance.contentIsPersonalised()).toBe(false);
  });

  it.each([
    {brandingMode: BrandingMode.UNBRANDED, personalised: false, committeeOnly: false, recipientMode: RecipientMode.SELECTED_MEMBERS, kind: EmailCompositionKind.STANDARD, privateAddresses: false, sharedTo: true},
    {brandingMode: BrandingMode.UNBRANDED, personalised: true, committeeOnly: false, recipientMode: RecipientMode.SELECTED_MEMBERS, kind: EmailCompositionKind.STANDARD, privateAddresses: true, sharedTo: false},
    {brandingMode: BrandingMode.BRANDED, personalised: false, committeeOnly: false, recipientMode: RecipientMode.SELECTED_MEMBERS, kind: EmailCompositionKind.STANDARD, privateAddresses: true, sharedTo: false},
    {brandingMode: BrandingMode.BRANDED, personalised: false, committeeOnly: true, recipientMode: RecipientMode.SELECTED_MEMBERS, kind: EmailCompositionKind.STANDARD, privateAddresses: true, sharedTo: false},
    {brandingMode: BrandingMode.UNBRANDED, personalised: false, committeeOnly: false, recipientMode: RecipientMode.ENTIRE_LIST, kind: EmailCompositionKind.STANDARD, privateAddresses: false, sharedTo: true},
    {brandingMode: BrandingMode.UNBRANDED, personalised: false, committeeOnly: false, recipientMode: RecipientMode.SELECTED_MEMBERS, kind: EmailCompositionKind.NEWSLETTER, privateAddresses: false, sharedTo: true}
  ])("uses the matching privacy notice and To routing for $brandingMode, personalisation $personalised, committee $committeeOnly, $recipientMode and $kind", ({brandingMode, personalised, committeeOnly, recipientMode, kind, privateAddresses, sharedTo}) => {
    const instance = composer({
      recipientResolution: {totalRecipientCount: () => 3, committeeOnlyAudience: () => committeeOnly},
      contentIsPersonalised: () => personalised,
      visibleToRecipientCount: () => 2
    });
    instance.session.state.brandingMode = brandingMode;
    instance.session.state.recipientMode = recipientMode;
    instance.session.state.compositionKind = kind;
    expect(instance.recipientAddressesArePrivate()).toBe(privateAddresses);
    expect(instance.canShareRecipientAddressesOnTo()).toBe(sharedTo);
  });

  it.each([RecipientMode.SELECTED_MEMBERS, RecipientMode.ENTIRE_LIST])("submits one shared unbranded message with the chosen To, Cc and Bcc recipients in %s mode", async recipientMode => {
    const startBatch = vi.fn().mockResolvedValue({jobId: "job-1", totalRecipients: 4});
    const instance = composer({
      documents: {resolveCommitteeFileLinksForSend: vi.fn().mockResolvedValue(null)},
      composedBodyParts: () => ({top: "Hello everyone", bottom: "", combined: "Hello everyone"}),
      contentIsPersonalised: () => false,
      sender: {
        unbrandedSenderInfo: () => ({email: "secretary@group.example.org.uk", name: "Secretary"}),
        resolvedBrandedSenderIdentity: () => null,
        resolvedUnbrandedRole: () => ({type: "secretary"}),
        resolvedUnbrandedSenderEmail: () => "secretary@group.example.org.uk"
      },
      recipientResolution: {
        recipientListIds: () => [],
        totalRecipientCount: () => 4,
        committeeOnlyAudience: () => false,
        sendingAsCampaign: () => false,
        uniqueSendEntries: () => [{name: "chair@group.example.org.uk"}, {name: "guest@example.com"}],
        expandedHeaderRecipients: recipients => recipients,
        uniqueEntriesFrom: recipients => recipients.map(recipient => ({name: recipient.email})),
        useCommitteeRoleAddresses: () => true
      },
      sendService: {startBatch},
      pollBatchStatus: vi.fn()
    });
    Object.assign(instance.session.state, {
      brandingMode: BrandingMode.UNBRANDED,
      recipientMode,
      compositionKind: EmailCompositionKind.NEWSLETTER,
      externalRecipients: [{email: "chair@group.example.org.uk"}, {email: "guest@example.com"}],
      ccRecipients: [{email: "alex.reed@example.com"}],
      bccRecipients: [{email: "sam.taylor@example.com"}]
    });
    await instance.startBatchTransactionalSend([]);
    expect(startBatch).toHaveBeenCalledWith(expect.objectContaining({
      sharedToRecipients: true,
      useCommitteeRoleAddresses: true,
      externalRecipients: instance.session.state.externalRecipients,
      ccRecipients: instance.session.state.ccRecipients,
      bccRecipients: instance.session.state.bccRecipients
    }));
    expect(startBatch.mock.calls[0][0].sharedMemberRecipientsAsBcc).not.toBe(true);
    expect(instance.recipientAddressesArePrivate()).toBe(false);
    expect(instance.sendingChannelLabel()).toBe("one email using To, Cc and Bcc");
    expect(instance.sharedToAddressPreview()).toBe("(chair@group.example.org.uk, guest@example.com)");
  });

  it("sends one message when the only To recipient has committee members on Bcc", () => {
    const instance = composer({
      recipientResolution: {
        sendingAsCampaign: () => false,
        uniqueSendEntries: () => [{name: "Alex Reed", member: {id: "alex"}}],
        totalRecipientCount: () => 1,
        committeeOnlyAudience: () => false
      },
      contentIsPersonalised: () => true
    });
    instance.previewRecipientIndex = 0;
    instance.session.state.brandingMode = BrandingMode.BRANDED;
    instance.session.state.recipientMode = RecipientMode.SELECTED_MEMBERS;
    instance.session.state.externalRecipients = [{email: "alex.reed@example.com", name: "Alex Reed", memberId: "alex"}];
    instance.session.state.bccRecipients = [
      {email: "membership@group.example.org.uk", name: "Membership Co-ordinator", memberId: "tim"}
    ];
    expect(instance.sendingChannelLabel()).toBe("one email using To, Cc and Bcc");
    expect(instance.recipientAddressesArePrivate()).toBe(false);
    expect(instance.estimatedSendTime()).toBe("1s");
    expect(instance.previewEntries()).toEqual([{name: "Alex Reed", member: {id: "alex"}}]);
    expect(instance.previewRecipientLabel()).toBe("1 of 1 - Alex Reed");
  });
});
