import {ChangeDetectorRef, Component, inject} from "@angular/core";
import {TestBed} from "@angular/core/testing";
import {describe, expect, it, vi} from "vitest";
import {EmailComposer} from "./email-composer";
import {EmailComposerStepKey} from "../../models/email-composer.model";

@Component({template: `<button (click)="act()">Continue</button><p>{{ feedback() }}</p>`})
class ComposerFeedbackTestHost {
  changeDetector = inject(ChangeDetectorRef);
  act: () => void = () => null;
  feedback: () => string = () => "Editing";
}

describe("composer feedback after editing without a blur notification", () => {
  async function composer() {
    TestBed.configureTestingModule({imports: [ComposerFeedbackTestHost]});
    const fixture = TestBed.createComponent(ComposerFeedbackTestHost);
    fixture.autoDetectChanges();
    await fixture.whenStable();
    const instance = Object.assign(Object.create(EmailComposer.prototype), {
      changeDetector: fixture.componentInstance.changeDetector,
      composerCdHeld: false,
      typingDoChecks: {count: 0},
      typingLogger: {info: vi.fn()},
      hasSendBlockers: () => false,
      confirmSend: true,
      sendConfirm: {as: vi.fn()},
      session: {syncStateToUrl: vi.fn()},
      markdownEditors: [],
      stepperActiveTab: EmailComposerStepKey.COMPOSE
    });
    return {fixture, instance};
  }

  it("shows Confirm send when Send is clicked while screen updates are paused", async () => {
    const {fixture, instance} = await composer();
    fixture.componentInstance.feedback = () => instance.sendConfirm.as.mock.calls.length ? "Confirm send" : "Editing";
    fixture.componentInstance.act = () => instance.armSend();
    instance.holdComposerChangeDetection("body");
    fixture.nativeElement.querySelector("button").click();
    await fixture.whenStable();
    expect(instance.sendConfirm.as).toHaveBeenCalledOnce();
    expect(fixture.nativeElement.querySelector("p").textContent).toBe("Confirm send");
  });

  it("renders the Send step and later asynchronous progress after leaving a focused editor", async () => {
    const {fixture, instance} = await composer();
    const status = {text: "Editing"};
    const progress = {resolve: (text: string): void => { status.text = text; }};
    const completion = new Promise<string>(resolve => { progress.resolve = resolve; });
    fixture.componentInstance.feedback = () => `${instance.stepperActiveTab}: ${status.text}`;
    fixture.componentInstance.act = () => {
      instance.setActiveStepperTab(EmailComposerStepKey.SEND);
      void completion.then(text => {
        status.text = text;
        instance.changeDetector.markForCheck();
      });
    };
    instance.holdComposerChangeDetection("body");
    fixture.nativeElement.querySelector("button").click();
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector("p").textContent).toBe(`${EmailComposerStepKey.SEND}: Editing`);
    progress.resolve("Sent successfully");
    await completion;
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector("p").textContent).toBe(`${EmailComposerStepKey.SEND}: Sent successfully`);
  });

  it("resumes screen updates when editor content is flushed for saving or sending", async () => {
    const {fixture, instance} = await composer();
    const status = {text: "Editing"};
    const flushMarkdownEmit = vi.fn();
    instance.markdownEditors = [ {flushMarkdownEmit} ];
    fixture.componentInstance.feedback = () => status.text;
    fixture.componentInstance.act = () => {
      instance.flushComposerEditors();
      status.text = "Draft saved";
    };
    instance.holdComposerChangeDetection("subject");
    fixture.nativeElement.querySelector("button").click();
    await fixture.whenStable();
    expect(flushMarkdownEmit).toHaveBeenCalledOnce();
    expect(fixture.nativeElement.querySelector("p").textContent).toBe("Draft saved");
  });
});
