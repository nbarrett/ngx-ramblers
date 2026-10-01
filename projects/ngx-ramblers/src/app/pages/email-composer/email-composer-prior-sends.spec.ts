import {describe, expect, it, vi} from "vitest";
import {EmailComposer} from "./email-composer";

describe("email type prior-send state", () => {
  function composer() {
    const instance = Object.create(EmailComposer.prototype);
    Object.assign(instance, {
      session: {state: {notificationConfig: {id: "welcome", subject: {text: "Welcome"}}, subject: "Welcome"}, syncStateToUrl: vi.fn()},
      priorSendExclusions: [{member: {id: "fictional-member"}, sentAt: 1}],
      workflowArrivalConfigId: "previous-workflow",
      priorSendDetailsExpanded: true,
      includeAlreadySent: true,
      recipients: {applyRecipientDefaultsFrom: vi.fn(), syncNotificationConfigBccIntoBcc: vi.fn()},
      eventsStepOmitted: () => false,
      validSignoffRolesFor: () => [],
      configToSlug: () => "newsletter",
      refreshTemplateContent: vi.fn(),
      fragmentEditor: {ensureFragmentOrder: vi.fn()},
      maybeAutoRefreshPreview: vi.fn()
    });
    return instance;
  }

  it("clears the previous type's exclusions, resend option and expanded details", () => {
    const instance = composer();
    instance.applyNotificationConfig({id: "newsletter", subject: {text: "Newsletter"}});
    expect(instance.priorSendExclusions).toEqual([]);
    expect(instance.workflowArrivalConfigId).toBe(null);
    expect(instance.includeAlreadySent).toBe(false);
    expect(instance.priorSendDetailsExpanded).toBe(false);
  });

  it("preserves prior-send choices when reapplying the same type", () => {
    const instance = composer();
    instance.applyNotificationConfig({id: "welcome", subject: {text: "Welcome"}});
    expect(instance.priorSendExclusions).toHaveLength(1);
    expect(instance.includeAlreadySent).toBe(true);
  });
});
