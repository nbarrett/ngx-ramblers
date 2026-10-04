import { BehaviorSubject } from "rxjs";
import { StoredValue } from "../../../models/ui-actions";
import { ActivatedRoute, Router } from "@angular/router";
import { CalendarApp } from "../../../models/inbox.model";
import { TestBed } from "@angular/core/testing";
import { vi } from "vitest";
import { CalendarSubscriptionScope, OutlookCalendarPlatform } from "../../../models/walk-programme.model";
import { ClipboardService } from "../../../services/clipboard.service";
import { CalendarSubscribeComponent } from "./calendar-subscribe";

describe("CalendarSubscribeComponent", () => {
  const queryParams = new BehaviorSubject<Record<string, string>>({});
  const clipboard = {copyToClipboard: vi.fn(), clipboardText: vi.fn()};

  beforeEach(() => {
    queryParams.next({});
    clipboard.copyToClipboard.mockReset().mockResolvedValue(null);
    clipboard.clipboardText.mockReset().mockReturnValue(null);
    TestBed.configureTestingModule({
      imports: [CalendarSubscribeComponent],
      providers: [{provide: Router, useValue: {navigate: vi.fn().mockResolvedValue(true)}}, {provide: ActivatedRoute, useValue: {queryParams}}, {provide: ClipboardService, useValue: clipboard}]
    });
  });

  it("offers a subscription to the site's existing feed rather than an individual event", () => {
    const fixture = TestBed.createComponent(CalendarSubscribeComponent);
    fixture.detectChanges();
    const button = fixture.nativeElement.querySelector("button");
    expect(button.getAttribute("aria-expanded")).toBe("false");
    button.click();
    fixture.detectChanges();
    const component = fixture.componentInstance;
    expect(component.feedUrl()).toBe(window.location.origin + "/api/calendar/events.ics");
    expect(fixture.nativeElement.querySelector("a").getAttribute("href"))
      .toBe(component.feedUrl().replace(/^https?:/, "webcal:"));
    expect(fixture.nativeElement.querySelector("[aria-label='Calendar subscription URL']").value).toBe(component.feedUrl());
    expect(button.getAttribute("aria-expanded")).toBe("true");
    button.click();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector("[aria-label='Calendar subscription URL']")).toBeNull();
    expect(button.getAttribute("aria-expanded")).toBe("false");
  });

  it("uses the member feed only for walks the member leads", async () => {
    const fixture = TestBed.createComponent(CalendarSubscribeComponent);
    fixture.componentRef.setInput("memberId", "member-example");
    const component = fixture.componentInstance;
    fixture.detectChanges();
    fixture.nativeElement.querySelector("button").click();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.nativeElement.querySelector("input[type=radio]").click();
    fixture.detectChanges();
    await fixture.whenStable();
    expect(component.scope()).toBe(CalendarSubscriptionScope.OWN);
    expect(component.feedUrl()).toBe(window.location.origin + "/api/calendar/member/member-example/events.ics");
    fixture.nativeElement.querySelectorAll("input[type=radio]")[1].click();
    fixture.detectChanges();
    await fixture.whenStable();
    expect(component.feedUrl()).toBe(window.location.origin + "/api/calendar/events.ics");
  });

  it("shows only the selected calendar's setup steps", () => {
    const fixture = TestBed.createComponent(CalendarSubscribeComponent);
    fixture.detectChanges();
    fixture.componentInstance.expanded.set(true);
    fixture.componentInstance.selectCalendar(CalendarApp.GOOGLE);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain("Copy the subscription link");
    expect(fixture.nativeElement.textContent).toContain("Other calendars");
    expect(fixture.nativeElement.querySelector("a[href^=\"webcal:\"]")).toBeNull();
    fixture.componentInstance.selectCalendar(CalendarApp.OUTLOOK);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain("Subscribe from web");
    expect(fixture.nativeElement.textContent).not.toContain("In the left sidebar");
  });

  it("reconstructs the expanded view and personal feed from the URL", () => {
    queryParams.next({
      [StoredValue.CALENDAR_APP]: CalendarApp.GOOGLE,
      [StoredValue.CALENDAR_SUBSCRIPTION_SCOPE]: CalendarSubscriptionScope.OWN
    });
    const fixture = TestBed.createComponent(CalendarSubscribeComponent);
    fixture.componentRef.setInput("memberId", "member-example");
    fixture.detectChanges();
    expect(fixture.componentInstance.expanded()).toBe(true);
    expect(fixture.componentInstance.calendarApp()).toBe(CalendarApp.GOOGLE);
    expect(fixture.componentInstance.scope()).toBe(CalendarSubscriptionScope.OWN);
    expect(fixture.nativeElement.textContent).toContain("Other calendars");
    expect(fixture.componentInstance.feedUrl()).toContain("/member/member-example/events.ics");
    queryParams.next({});
    fixture.detectChanges();
    expect(fixture.componentInstance.expanded()).toBe(false);
  });

  it("shows instructions only for the selected Outlook platform and restores it from the URL", () => {
    queryParams.next({[StoredValue.CALENDAR_APP]: OutlookCalendarPlatform.WINDOWS_CLASSIC});
    const fixture = TestBed.createComponent(CalendarSubscribeComponent);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain("Home");
    expect(fixture.nativeElement.textContent).not.toContain("Return to Outlook on your Mac");
    fixture.componentInstance.selectCalendar(OutlookCalendarPlatform.MAC);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain("Return to Outlook on your Mac");
    expect(fixture.nativeElement.textContent).not.toContain("Home");
  });

  it("copies the feed and confirms success only when the clipboard service reports it", async () => {
    const component = TestBed.createComponent(CalendarSubscribeComponent).componentInstance;
    await component.copyUrl();
    expect(clipboard.copyToClipboard).toHaveBeenCalledWith(component.feedUrl());
    expect(component.copyMessage()).toBe("Open Manual setup below, select the address and copy it manually.");
    clipboard.clipboardText.mockReturnValue(component.feedUrl());
    await component.copyUrl();
    expect(component.copyMessage()).toBe("Subscription link copied. Paste it into your calendar in the step described above.");
  });
});
