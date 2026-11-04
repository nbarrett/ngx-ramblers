import {NgSelectComponent} from "@ng-select/ng-select";
import {TestBed} from "@angular/core/testing";
import {By} from "@angular/platform-browser";
import {provideRouter} from "@angular/router";
import {describe, expect, it, vi} from "vitest";
import {EmailComposerProgrammeComponent} from "./email-composer-programme.component";
import {EmailComposerProgrammeService} from "../../services/email-composer/email-composer-programme.service";
import {EmailComposerSessionService} from "../../services/email-composer/email-composer-session.service";
import {EmailComposerStepKey, ProgrammeEventFormat} from "../../models/email-composer.model";
import {Subject} from "rxjs";

describe("event format selection", () => {
  async function setup() {
    const settings = {format: ProgrammeEventFormat.DETAILED};
    const programme = {settings: () => settings, selectFormat: vi.fn(), applyTemplate: vi.fn()};
    const requestStep = new Subject<EmailComposerStepKey>();
    const session = {requestStep};
    TestBed.configureTestingModule({imports: [EmailComposerProgrammeComponent],
      providers: [provideRouter([]),
        {provide: EmailComposerProgrammeService, useValue: programme},
        {provide: EmailComposerSessionService, useValue: session}]});
    const fixture = TestBed.createComponent(EmailComposerProgrammeComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    return {fixture, programme, requestStep, host: fixture.nativeElement as HTMLElement};
  }

  it("changes format without a generate step or an in-place preview", async () => {
    const {fixture, programme, host} = await setup();
    expect(host.textContent).toContain("Preview & Review");
    expect(host.textContent).not.toContain("Generate");
    expect(host.querySelector("app-email-preview")).toBeNull();
    expect(host.querySelector("app-committee-document-editor")).toBeNull();
    expect([...host.querySelectorAll("button")].find(button => button.textContent.trim() === "PDF")).toBeUndefined();
    const select = fixture.debugElement.query(By.directive(NgSelectComponent)).componentInstance as NgSelectComponent;
    select.select(select.itemsList.items.find(item => item.value === ProgrammeEventFormat.COMPACT));
    fixture.detectChanges();
    await fixture.whenStable();
    expect(programme.selectFormat).toHaveBeenCalledOnce();
    expect(host.querySelector("a")?.getAttribute("href")).toContain("tab=event-templates");
  });

  it("opens Preview and Review from the format panel", async () => {
    const {host, requestStep} = await setup();
    const next = vi.fn();
    const sub = requestStep.subscribe(next);
    [...host.querySelectorAll("a")].find(link => link.textContent.includes("Preview")).click();
    expect(next).toHaveBeenCalledWith(EmailComposerStepKey.REVIEW);
    sub.unsubscribe();
  });
});
