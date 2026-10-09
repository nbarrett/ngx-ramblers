import {Component, signal} from "@angular/core";
import {TestBed} from "@angular/core/testing";
import {By} from "@angular/platform-browser";
import {beforeEach, describe, expect, it} from "vitest";
import {AlertPanelComponent} from "./alert-panel";
import {AlertMessageComponent} from "./alert-message";

@Component({
  imports: [AlertPanelComponent, AlertMessageComponent],
  template: `
    <app-alert-panel grouped>
      <app-alert-message title="Subject needs editing" [messageKey]="subject()" actionLabel="Fix subject" (action)="fixes.set(fixes() + 1)">Update the subject.</app-alert-message>
      <app-alert-message title="Recipient privacy">Recipients receive separate copies.</app-alert-message>
    </app-alert-panel>
  `
})
class AlertPanelTestHost {
  subject = signal("Initial subject");
  fixes = signal(0);
}

@Component({
  imports: [AlertPanelComponent, AlertMessageComponent],
  template: `
    <app-alert-panel grouped compact>
      <app-alert-message title="Preparing campaign for Brevo…"/>
      <app-alert-message title="Campaign sent">successfully to the mailing list</app-alert-message>
    </app-alert-panel>
  `
})
class CompactAlertHost {}

describe("grouped alert messages", () => {
  beforeEach(() => TestBed.configureTestingModule({imports: [AlertPanelTestHost]}));

  it("uses one panel and dismisses only the chosen message", () => {
    const fixture = TestBed.createComponent(AlertPanelTestHost);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll(".alert-panel").length).toBe(1);
    const messages = fixture.debugElement.queryAll(By.directive(AlertMessageComponent));
    messages[0].nativeElement.querySelector(".alert-message-dismiss").click();
    fixture.detectChanges();
    expect(messages[0].nativeElement.hidden).toBe(true);
    expect(messages[1].nativeElement.hidden).toBe(false);
    expect(fixture.nativeElement.querySelectorAll(".alert-panel").length).toBe(1);
    expect(messages[1].nativeElement.querySelector("button").classList.contains("alert-message-dismiss")).toBe(true);
  });

  it("removes the empty panel and restores a message when its content changes", () => {
    const fixture = TestBed.createComponent(AlertPanelTestHost);
    fixture.detectChanges();
    const messages = fixture.debugElement.queryAll(By.directive(AlertMessageComponent));
    messages.forEach(message => message.nativeElement.querySelector(".alert-message-dismiss").click());
    fixture.detectChanges();
    expect(window.getComputedStyle(fixture.nativeElement.querySelector(".alert-panel")).display).toBe("none");
    fixture.componentInstance.subject.set("Changed subject");
    fixture.detectChanges();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll(".alert-panel").length).toBe(1);
    expect(window.getComputedStyle(fixture.nativeElement.querySelector(".alert-panel")).display).not.toBe("none");
    expect(messages[0].componentInstance.dismissed).toBe(false);
    expect(messages[1].componentInstance.dismissed).toBe(true);
  });

  it("renders both titles and bodies through the same layout and keeps Fix separate from dismissal", () => {
    const fixture = TestBed.createComponent(AlertPanelTestHost);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll(".alert-message-title").length).toBe(2);
    expect(fixture.nativeElement.querySelectorAll(".alert-message-body").length).toBe(2);
    const message = fixture.debugElement.queryAll(By.directive(AlertMessageComponent))[0];
    message.nativeElement.querySelector(".alert-message-actions a").click();
    fixture.detectChanges();
    expect(fixture.componentInstance.fixes()).toBe(1);
    expect(message.componentInstance.dismissed).toBe(false);
  });

});

describe("compact alert messages", () => {
  beforeEach(() => TestBed.configureTestingModule({imports: [CompactAlertHost]}));

  it("keeps a title-only compact message without a body", () => {
    const fixture = TestBed.createComponent(CompactAlertHost);
    fixture.detectChanges();
    const bodies = fixture.nativeElement.querySelectorAll(".alert-message-body");
    expect(bodies[0].textContent).toEqual("");
    expect(bodies[1].textContent).toContain("successfully to the mailing list");
  });

});
