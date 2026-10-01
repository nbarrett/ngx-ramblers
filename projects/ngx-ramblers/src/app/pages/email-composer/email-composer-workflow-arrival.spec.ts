import {describe, expect, it, vi} from "vitest";
import {EmailComposer} from "./email-composer";
import {defaultEmailComposerState} from "../../functions/email-composer";

describe("workflow arrival guidance", () => {
  function composer() {
    const instance = Object.create(EmailComposer.prototype);
    const first = {id: "first", nextNotificationConfigId: "second"};
    const second = {id: "second"};
    const state = defaultEmailComposerState();
    state.notificationConfig = first as any;
    Object.assign(instance, {
      session: {state, notify: {hide: vi.fn()}},
      recipientSources: {mailMessagingConfig: {notificationConfigs: [first, second]}},
      sendConfirm: {clear: vi.fn()},
      goToStepKey: vi.fn(),
      onEmailConfigChanged: (config: any) => { state.notificationConfig = config; }
    });
    return {instance, first, second};
  }

  it("omits restart guidance after continuing from the preceding step", async () => {
    const {instance, second} = composer();
    await instance.continueToNextConfig(second);
    expect(instance.precedingConfig()).toBe(null);
  });

  it("shows restart guidance for a directly selected later step", () => {
    const {instance, first, second} = composer();
    instance.session.state.notificationConfig = second;
    expect(instance.precedingConfig()).toBe(first);
  });

  it("does not suppress guidance for an unrelated arrival", () => {
    const {instance, first, second} = composer();
    instance.session.state.notificationConfig = second;
    instance.workflowArrivalConfigId = "unrelated";
    expect(instance.precedingConfig()).toBe(first);
  });
});
