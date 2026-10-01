import {FocusInputDirective} from "../../modules/common/focus-input/focus-input.directive";
import {Component, signal} from "@angular/core";
import {TestBed} from "@angular/core/testing";
import {describe, expect, it, vi} from "vitest";
import {EmailComposer} from "./email-composer";
import {EmailComposerStepKey} from "../../models/email-composer.model";

@Component({imports: [FocusInputDirective], template: `<button (click)="fix()">Fix subject</button>@if (composeVisible()) {<input id="subject" [appFocusInput]="subjectRequested()" (focusCompleted)="subjectRequested.set(false)">}<textarea id="body"></textarea>`})
class SubjectFocusTestHost {
  composeVisible = signal(false);
  subjectRequested = signal(false);
  fix: () => void = () => null;
}

describe("composer subject correction", () => {
  it("focuses the subject after opening Compose without requesting body-editor focus", async () => {
    TestBed.configureTestingModule({imports: [SubjectFocusTestHost]});
    const fixture = TestBed.createComponent(SubjectFocusTestHost);
    fixture.detectChanges();
    const body = fixture.nativeElement.querySelector("textarea");
    const context = {
      pendingIntroFocus: true,
      get pendingSubjectFocus() { return fixture.componentInstance.subjectRequested(); },
      set pendingSubjectFocus(value: boolean) { fixture.componentInstance.subjectRequested.set(value); },
      sendInProgress: false,
      sendConfirm: {clear: vi.fn()},
      canAccessStep: vi.fn(() => true),
      setActiveStepperTab: vi.fn(() => fixture.componentInstance.composeVisible.set(true)),
      autoResolveTrackingUrls: vi.fn(() => Promise.resolve()),
      focusComposeEditor: vi.fn(() => body.focus()),
      goToStepKey: (key: EmailComposerStepKey, focusComposeBody: boolean) => EmailComposer.prototype["goToStepKey"].call(context as unknown as EmailComposer, key, focusComposeBody)
    };
    fixture.componentInstance.fix = () => EmailComposer.prototype["goToCompose"].call(context as unknown as EmailComposer);
    vi.spyOn(HTMLElement.prototype, "getClientRects").mockReturnValue([{width: 100}] as unknown as DOMRectList);
    body.focus();
    fixture.nativeElement.querySelector("button").click();
    await fixture.whenStable();
    expect(context.setActiveStepperTab).toHaveBeenCalledWith(EmailComposerStepKey.COMPOSE);
    expect(context.pendingIntroFocus).toBe(false);
    expect(context.focusComposeEditor).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(fixture.nativeElement.querySelector("input"));
  });
});
