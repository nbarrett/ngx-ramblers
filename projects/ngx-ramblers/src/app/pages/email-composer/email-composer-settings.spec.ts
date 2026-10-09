import { describe, expect, it, vi } from "vitest";
import { EmailComposer } from "./email-composer";
import { Confirm, StoredValue } from "../../models/ui-actions";
import { ComposerShowAction, EmailComposerStepKey } from "../../models/email-composer.model";
import { BrandingMode } from "../../models/mail.model";
import { ButtonDropdownItemType } from "../../models/button-dropdown.model";
import { faFile, faFolderOpen, faPaperPlane } from "@fortawesome/free-solid-svg-icons";

describe("composer personal settings", () => {
  function composer(overrides: Record<string, unknown> = {}) {
    const instance = Object.create(EmailComposer.prototype);
    Object.assign(instance, {
      composerSettingsOpen: false,
      confirmSend: true,
      warnUnsaved: true,
      sendInProgress: false,
      sendConfirm: new Confirm(),
      hasSendBlockers: () => false,
      executeSend: vi.fn(),
      shouldWarnAboutUnsavedChanges: () => true,
      session: {syncStateToUrl: vi.fn()},
      ...overrides
    });
    return instance;
  }

  it("opens and closes the heading gear panel", () => {
    const instance = composer();
    const event = {stopPropagation: vi.fn()} as unknown as MouseEvent;
    instance.toggleComposerSettings(event);
    expect(event.stopPropagation).toHaveBeenCalled();
    expect(instance.composerSettingsOpen).toBe(true);
    expect(instance.session.syncStateToUrl).toHaveBeenCalledWith({[StoredValue.CONFIGURE]: "true"});
    instance.toggleComposerSettings(event);
    expect(instance.composerSettingsOpen).toBe(false);
    expect(instance.session.syncStateToUrl).toHaveBeenCalledWith({[StoredValue.CONFIGURE]: null});
  });

  it("closes the panel on escape or a click elsewhere", () => {
    const instance = composer({composerSettingsOpen: true});
    instance.closeComposerSettingsOnEscape();
    expect(instance.composerSettingsOpen).toBe(false);
    expect(instance.session.syncStateToUrl).toHaveBeenCalledWith({[StoredValue.CONFIGURE]: null});
    instance.composerSettingsOpen = true;
    instance.closeComposerSettingsOnDocumentClick();
    expect(instance.composerSettingsOpen).toBe(false);
  });

  it("arms confirm send when that preference is on", () => {
    const instance = composer();
    instance.armSend();
    expect(instance.sendConfirm.notificationsOutstanding()).toBe(true);
    expect(instance.executeSend).not.toHaveBeenCalled();
  });

  it("sends immediately when confirm send is off", () => {
    const instance = composer({confirmSend: false});
    instance.armSend();
    expect(instance.sendConfirm.notificationsOutstanding()).toBe(false);
    expect(instance.executeSend).toHaveBeenCalled();
  });

  it("allows leaving when the unsaved warning is off", () => {
    const instance = composer({warnUnsaved: false});
    expect(instance.confirmNavigationAway()).toBe(true);
  });

  it("starts a new email when the unsaved warning is off", () => {
    const instance = composer({warnUnsaved: false, newComposition: vi.fn()});
    instance.startNewEmail();
    expect(instance.newComposition).toHaveBeenCalled();
  });

  it("puts New email on the Show menu", () => {
    const instance = composer({
      draftsPanelOpen: false,
      sentEmailsPanelOpen: false,
      drafts: [],
      sentEmails: [],
      faFolderOpen,
      faPaperPlane,
      faFile
    });
    const items = instance.showMenuItems();
    expect(items.map(item => item.id)).toEqual([
      ComposerShowAction.DRAFTS,
      ComposerShowAction.SENT,
      "show-new-divider",
      ComposerShowAction.NEW
    ]);
    expect(items.find(item => item.id === "show-new-divider")?.type).toBe(ButtonDropdownItemType.DIVIDER);
    expect(items.find(item => item.id === ComposerShowAction.NEW)?.label).toBe("New email");
  });

  it("starts a new email from the Show menu", () => {
    const instance = composer({
      warnUnsaved: false,
      startNewEmail: vi.fn(),
      toggleDraftsPanel: vi.fn(),
      toggleSentEmailsPanel: vi.fn()
    });
    instance.onShowMenu(ComposerShowAction.NEW);
    expect(instance.startNewEmail).toHaveBeenCalled();
    expect(instance.toggleDraftsPanel).not.toHaveBeenCalled();
    expect(instance.toggleSentEmailsPanel).not.toHaveBeenCalled();
  });

  it("clears leftover newsletter state when starting a new email", () => {
    const setActiveStepperTab = vi.fn();
    const resetForNewComposition = vi.fn();
    const instance = Object.create(EmailComposer.prototype);
    Object.assign(instance, {
      recipients: {
        forcedMemberId: "member-1",
        narrowMembersExpanded: false,
        recipientAddressModeTouched: true,
        userPickedRecipientMode: true
      },
      rememberBranding: false,
      recipientSources: {mailMessagingConfig: null},
      session: {
        state: {subject: "old newsletter"},
        currentDraftId: "draft-1",
        inboxReplyContext: {threadId: "thread-1"},
        notify: {hide: vi.fn()}
      },
      drafting: {resetForNewComposition},
      fragmentEditor: {expandedFragmentIds: new Set(["events"])},
      documents: {
        committeeFiles: new Map([["a", {}]]),
        committeeFileUrlInput: "https://example.org",
        committeeFileUrlError: "bad",
        committeeFileUrlAllowedIds: ["a"]
      },
      sendConfirm: {clear: vi.fn()},
      setActiveStepperTab,
      batchProgress: {},
      batchJobLost: true,
      campaignSendComplete: true,
      nextConfigAfterSend: {},
      userPickedEmailType: true,
      userHasEditedComposer: true,
      cancelArmed: true,
      lastSavedAt: 1,
      composeShared: true,
      draftsPanelOpen: true,
      unbrandedSenderAlertDismissed: true,
      routeCompositionKey: "old"
    });
    instance.newComposition();
    expect(resetForNewComposition).toHaveBeenCalled();
    expect(instance.session.currentDraftId).toBe(null);
    expect(instance.session.inboxReplyContext).toBe(null);
    expect(instance.session.state.subject).toBe("");
    expect(setActiveStepperTab).toHaveBeenCalledWith(EmailComposerStepKey.TEMPLATE, expect.objectContaining({
      [StoredValue.DRAFT_ID]: null,
      [StoredValue.EVENT_INCLUSION]: null,
      [StoredValue.DATE_FROM]: null,
      [StoredValue.DATE_TO]: null,
      [StoredValue.THREAD]: null
    }));
  });

  it("starts from the remembered email type when that preference is on", () => {
    const newsletter = {id: "newsletter-id"};
    const loginDetails = {id: "login-id"};
    const applyNotificationConfig = vi.fn();
    const instance = composer({
      rememberBranding: true,
      userPickedEmailType: false,
      forcedConfigId: null,
      session: {state: {notificationConfigListing: {}, notificationConfig: null, brandingMode: BrandingMode.BRANDED}},
      mailMessagingService: {notificationConfigs: () => [newsletter, loginDetails]},
      uiActions: {initialValueFor: () => "login-id"},
      applyNotificationConfig,
      applyGroupEventCampaignRecipients: vi.fn(),
      preferredConfigForCurrentContext: () => undefined
    });
    instance.autoSelectNotificationConfig();
    expect(applyNotificationConfig).toHaveBeenCalledWith(loginDetails);
  });

  it("names the specified default email type in the Off hint", () => {
    const instance = composer({
      session: {state: {notificationConfigListing: {}}},
      mailMessagingService: {
        notificationConfigs: () => [
          {defaultListing: true, subject: {text: "Newsletter"}},
          {subject: {text: "Walk notice"}}
        ]
      }
    });
    expect(instance.defaultNewEmailTypeHint()).toBe("Newsletter");
  });

  it("names the first email type in the Off hint when no default is specified", () => {
    const instance = composer({
      session: {state: {notificationConfigListing: {}}},
      mailMessagingService: {
        notificationConfigs: () => [
          {subject: {text: "Walk notice"}},
          {subject: {text: "Newsletter"}}
        ]
      }
    });
    expect(instance.defaultNewEmailTypeHint()).toBe("the first email type (Walk notice)");
  });

  it("starts from the default email configuration when remember last type is off", () => {
    const newsletter = {id: "newsletter-id", defaultListing: true};
    const loginDetails = {id: "login-id"};
    const applyNotificationConfig = vi.fn();
    const instance = composer({
      rememberBranding: false,
      userPickedEmailType: false,
      forcedConfigId: null,
      session: {state: {notificationConfigListing: {}, notificationConfig: null, brandingMode: BrandingMode.BRANDED}},
      mailMessagingService: {notificationConfigs: () => [newsletter, loginDetails]},
      uiActions: {initialValueFor: () => "login-id"},
      applyNotificationConfig,
      applyGroupEventCampaignRecipients: vi.fn(),
      preferredConfigForCurrentContext: () => undefined
    });
    instance.autoSelectNotificationConfig();
    expect(applyNotificationConfig).toHaveBeenCalledWith(newsletter);
  });
});
