import {describe, expect, it, vi} from "vitest";
import {Member} from "../../models/member.model";
import {EmailComposer} from "./email-composer";
import {defaultEmailComposerState} from "../../functions/email-composer";
import {EmailComposerStepKey, RecipientMode} from "../../models/email-composer.model";

describe("composer step validation", () => {
  it("blocks later steps and direct tab changes until the automatic subject is changed", () => {
    const state = defaultEmailComposerState();
    state.subject = "Automatic heading";
    const context = {
      session: {state},
      composeStepOmitted: () => false,
      eventsStepOmitted: () => false,
      templateStepValid: () => true,
      recipientsStepValid: () => true,
      subjectStartsWithCopyOf: () => false,
      subjectUnchangedFromDefault: () => state.subject === "Automatic heading",
      composeStepErrors: () => EmailComposer.prototype.composeStepErrors.call(context as unknown as EmailComposer),
      composeStepValid: () => EmailComposer.prototype.composeStepValid.call(context as unknown as EmailComposer),
      canAccessStep: (key: EmailComposerStepKey) => EmailComposer.prototype.canAccessStep.call(context as unknown as EmailComposer, key),
      stepperActiveTab: EmailComposerStepKey.COMPOSE,
      stepperRef: {value: {set: vi.fn()}},
      setActiveStepperTab: vi.fn()
    };
    const laterSteps = [EmailComposerStepKey.EVENTS, EmailComposerStepKey.REVIEW, EmailComposerStepKey.SEND];
    expect(laterSteps.map(key => context.canAccessStep(key))).toEqual([false, false, false]);
    EmailComposer.prototype.onStepperValueChange.call(context as unknown as EmailComposer, EmailComposerStepKey.SEND);
    expect(context.setActiveStepperTab).not.toHaveBeenCalled();
    expect(context.stepperRef.value.set).toHaveBeenCalledWith(EmailComposerStepKey.COMPOSE);
    state.subject = "Upcoming group activities";
    expect(laterSteps.map(key => context.canAccessStep(key))).toEqual([true, true, true]);
  });
  it("identifies each unavailable recipient and their reason", () => {
    const state = defaultEmailComposerState();
    state.recipientMode = RecipientMode.SELECTED_MEMBERS;
    state.selectedMemberIds = ["alex", "sam"];
    const instance = Object.create(EmailComposer.prototype);
    Object.assign(instance, {
      session: {state},
      recipientSources: {workflowRemovesRecipients: () => false},
      blockedSelectedMembers: () => [
        {member: {id: "alex", firstName: "Alex", email: "alex@example.com"}, reason: "has not given consent"},
        {member: {id: "sam", firstName: "Sam", email: "sam@example.com"}, reason: "has unsubscribed"}
      ],
      memberFullName: (member: Member) => member.firstName
    });
    expect(instance.unavailableRecipientReasons()).toEqual({
      "alex@example.com": "has not given consent",
      "sam@example.com": "has unsubscribed"
    });
    expect(instance.recipientsStepErrors()).toEqual([
      "Alex has not given consent and cannot be emailed — remove this member from the recipients to continue",
      "Sam has unsubscribed and cannot be emailed — remove this member from the recipients to continue"
    ]);
  });
});
