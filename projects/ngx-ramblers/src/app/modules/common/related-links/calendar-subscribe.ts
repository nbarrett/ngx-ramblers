import { Component, computed, inject, Input, OnDestroy, OnInit, signal } from "@angular/core";
import { ActivatedRoute, Router } from "@angular/router";
import { Subscription } from "rxjs";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { faCalendarPlus, faCopy } from "@fortawesome/free-solid-svg-icons";
import { faApple, faGoogle, faMicrosoft, faWindows } from "@fortawesome/free-brands-svg-icons";
import { StoredValue } from "../../../models/ui-actions";
import { CalendarApp } from "../../../models/inbox.model";
import { SectionToggleTab } from "../../../models/section-toggle.model";
import { SectionToggle } from "../../../shared/components/section-toggle";
import { browserCalendarClientHints, localCalendarHref } from "../../../functions/calendar-add";
import { FormsModule } from "@angular/forms";
import { CalendarSubscriptionScope, OutlookCalendarPlatform } from "../../../models/walk-programme.model";
import { ClipboardService } from "../../../services/clipboard.service";

@Component({
  selector: "app-calendar-subscribe",
  imports: [FormsModule, FontAwesomeModule, SectionToggle],
  template: `
    <div class="d-flex align-items-center justify-content-between gap-3 flex-wrap">
      <p class="text-muted mb-0">See upcoming walks and events in your own calendar.</p>
      <button type="button" class="btn btn-primary" [attr.aria-expanded]="expanded()"
            (click)="toggleSubscription()">
      <fa-icon [icon]="faCalendarPlus" class="me-2"/>{{ expanded() ? "Hide subscription options" : "Subscribe to calendar" }}
      </button>
    </div>
    @if (expanded()) {
      <div class="mt-3">
        <fieldset class="mb-3">
          <legend class="h6">Which walks would you like?</legend>
          @if (memberId) {
            <label class="form-check-label d-inline-flex align-items-center me-3"><input class="form-check-input" type="radio" name="calendar-scope" [value]="CalendarSubscriptionScope.OWN"
              [ngModel]="scope()" (ngModelChange)="selectScope($event)"/> Only my own walks and events</label>
          }
          <label class="form-check-label d-inline-flex align-items-center"><input class="form-check-input" type="radio" name="calendar-scope" [value]="CalendarSubscriptionScope.EVERYONE"
            [ngModel]="scope()" (ngModelChange)="selectScope($event)"/> Everyone's walks and events</label>
        </fieldset>
        <p>“Only my own walks and events” includes walks you are leading. “Everyone’s walks and events” includes the whole group programme. The feed covers the next 12 months. Your calendar app checks the feed for updates; changes may take some time to appear.</p>
        <p class="fw-bold mb-2">Which calendar do you use?</p>
        <app-section-toggle stackOnMobile [tabs]="calendarTabs" [selectedTab]="selectedCalendar()" [queryParamKey]="StoredValue.CALENDAR_APP"
                            (selectedTabChange)="selectCalendar($event)"/>
        <div class="mt-3">
          @if (calendarApp() === CalendarApp.LOCAL) {
            <p>Open Apple Calendar using the button below, then confirm Subscribe. If it does not open, use Manual setup below.</p>
            <a class="btn btn-primary" [href]="appleUrl()"><fa-icon [icon]="faApple" class="me-2"/>Open Apple Calendar</a>
          } @else {
            <ol class="mt-3">
              <li class="mb-3">
                <p>Copy the subscription link. You will paste it into your calendar in step 3.</p>
                <button type="button" class="btn btn-primary" (click)="copyUrl()">
                  <fa-icon [icon]="faCopy" class="me-2"/>Copy subscription link
                </button>
              </li>
              <li class="mb-3">
                @if (calendarApp() === CalendarApp.GOOGLE) {
                  <p>Open Google Calendar on a computer.</p>
                  <a class="btn btn-primary" href="https://calendar.google.com/" target="_blank" rel="noopener noreferrer"><fa-icon [icon]="faGoogle" class="me-2"/>Open Google Calendar</a>
                } @else {
                  @if (outlookPlatform() === OutlookCalendarPlatform.MAC) {
                    <p>Open Outlook in your browser. Sign in with the same Microsoft account used in Outlook on your Mac.</p>
                    <div class="d-flex gap-2 flex-wrap">
                      <a class="btn btn-primary" href="https://outlook.live.com/calendar/" target="_blank" rel="noopener noreferrer"><fa-icon [icon]="faMicrosoft" class="me-2"/>Open personal Outlook</a>
                      <a class="btn btn-quiet" href="https://outlook.office.com/calendar/" target="_blank" rel="noopener noreferrer"><fa-icon [icon]="faMicrosoft" class="me-2"/>Open work or school Outlook</a>
                    </div>
                  } @else {
                    <p>Open the Calendar view in your Outlook desktop app.</p>
                  }
                }
              </li>
              <li>
                @if (calendarApp() === CalendarApp.GOOGLE) {
                  In the left sidebar, below <strong>My calendars</strong>, find <strong>Other calendars</strong>.
                  Click the small <strong>+</strong> beside that heading, then choose <strong>From URL</strong>.
                  This is a different button from <strong>Create</strong> at the top.
                  Paste the link you copied and choose <strong>Add calendar</strong>.
                } @else {
                  @switch (outlookPlatform()) {
                    @case (OutlookCalendarPlatform.MAC) {
                      <p>In the browser, choose <strong>Add calendar → Subscribe from web</strong> (or <strong>From internet</strong>).
                        Paste the copied link, name the calendar and choose <strong>Import</strong> or <strong>Save</strong>.</p>
                      <p>Return to Outlook on your Mac. The subscription appears under <strong>Other calendars</strong> in the same Microsoft account; allow a few minutes to sync.</p>
                      <details>
                        <summary>Why use the browser?</summary>
                        <p>The Mac app's <strong>Import ICS</strong> adds a one-off copy without updates.
                          This subscription route requires an Outlook.com or Microsoft 365/Exchange account.</p>
                      </details>
                    }
                    @case (OutlookCalendarPlatform.WINDOWS_NEW) {
                      Choose <strong>Add calendar → Subscribe from web</strong>.
                      Paste the copied link, name the calendar and choose <strong>Import</strong>.
                    }
                    @case (OutlookCalendarPlatform.WINDOWS_CLASSIC) {
                      On the <strong>Home</strong> ribbon, choose <strong>Open Calendar → From Internet</strong>.
                      Paste the copied link, choose <strong>OK</strong>, then confirm the subscription.
                    }
                  }
                }
              </li>
            </ol>
          }
        </div>
        <details class="mt-3">
          <summary>Manual setup</summary>
          <p class="mt-2">If you use another calendar app or the buttons do not work, copy this address into its calendar subscription setting.</p>
          <div class="d-flex align-items-center gap-2 flex-wrap">
            <input class="form-control" aria-label="Calendar subscription URL" readonly [value]="feedUrl()" #feedInput (click)="feedInput.select()"/>
            @if (calendarApp() === CalendarApp.LOCAL) {
              <button type="button" class="btn btn-quiet" (click)="copyUrl()"><fa-icon [icon]="faCopy" class="me-2"/>Copy subscription link</button>
            }
          </div>
        </details>
        <p class="mt-2 mb-0" role="status">{{ copyMessage() }}</p>
      </div>
    }
  `
})
export class CalendarSubscribeComponent implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private subscriptions: Subscription[] = [];
  private clipboard = inject(ClipboardService);
  protected readonly faCalendarPlus = faCalendarPlus;
  protected readonly faCopy = faCopy;
  protected readonly faApple = faApple;
  protected readonly faGoogle = faGoogle;
  protected readonly faMicrosoft = faMicrosoft;
  protected readonly CalendarApp = CalendarApp;
  protected readonly StoredValue = StoredValue;
  protected readonly OutlookCalendarPlatform = OutlookCalendarPlatform;
  readonly outlookPlatform = computed(() => this.selectedCalendar() as OutlookCalendarPlatform);
  readonly selectedCalendar = signal<CalendarApp | OutlookCalendarPlatform>(CalendarApp.LOCAL);
  readonly calendarApp = computed(() => this.selectedCalendar() === CalendarApp.LOCAL
    ? CalendarApp.LOCAL
    : this.selectedCalendar() === CalendarApp.GOOGLE ? CalendarApp.GOOGLE : CalendarApp.OUTLOOK);
  readonly calendarTabs: SectionToggleTab[] = [
    {value: CalendarApp.LOCAL, label: "Apple Calendar", icon: faApple},
    {value: CalendarApp.GOOGLE, label: "Google Calendar", icon: faGoogle},
    {value: OutlookCalendarPlatform.MAC, label: "Outlook on Mac", icon: faApple},
    {value: OutlookCalendarPlatform.WINDOWS_NEW, label: "Outlook on Windows (new)", icon: faWindows},
    {value: OutlookCalendarPlatform.WINDOWS_CLASSIC, label: "Outlook on Windows (classic)", icon: faWindows}
  ];
  readonly expanded = signal(false);
  readonly copyMessage = signal("");
  @Input() memberId: string = null;
  protected readonly CalendarSubscriptionScope = CalendarSubscriptionScope;
  readonly scope = signal(CalendarSubscriptionScope.EVERYONE);

  ngOnInit(): void {
    this.subscriptions.push(this.route.queryParams.subscribe(params => {
      const selected = params[StoredValue.CALENDAR_APP] === CalendarApp.OUTLOOK
        ? OutlookCalendarPlatform.MAC
        : params[StoredValue.CALENDAR_APP];
      const app = this.calendarTabs.find(tab => tab.value === selected);
      const scope = params[StoredValue.CALENDAR_SUBSCRIPTION_SCOPE];
      this.scope.set(scope === CalendarSubscriptionScope.OWN ? CalendarSubscriptionScope.OWN : CalendarSubscriptionScope.EVERYONE);
      this.expanded.set(!!app);
      if (app) {
        this.selectCalendar(app.value);
      }
    }));
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(subscription => subscription.unsubscribe());
  }

  toggleSubscription(): void {
    const expanded = !this.expanded();
    this.expanded.set(expanded);
    this.copyMessage.set("");
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {
        [StoredValue.CALENDAR_APP]: expanded ? this.selectedCalendar() : null,
        [StoredValue.CALENDAR_SUBSCRIPTION_SCOPE]: expanded ? this.scope() : null
      },
      queryParamsHandling: "merge"
    });
  }

  selectScope(scope: CalendarSubscriptionScope): void {
    this.scope.set(scope);
    this.copyMessage.set("");
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {[StoredValue.CALENDAR_SUBSCRIPTION_SCOPE]: scope},
      queryParamsHandling: "merge"
    });
  }

  selectCalendar(value: string): void {
    const selected = value === CalendarApp.OUTLOOK ? OutlookCalendarPlatform.MAC : value;
    const app = this.calendarTabs.find(tab => tab.value === selected);
    if (app) {
      this.selectedCalendar.set(app.value as CalendarApp | OutlookCalendarPlatform);
      this.copyMessage.set("");
    }
  }

  feedUrl(): string {
    const path = this.scope() === CalendarSubscriptionScope.OWN && this.memberId
      ? `/api/calendar/member/${encodeURIComponent(this.memberId)}/events.ics`
      : "/api/calendar/events.ics";
    return localCalendarHref(path, browserCalendarClientHints());
  }

  appleUrl(): string {
    return this.feedUrl().replace(/^https?:/, "webcal:");
  }

  async copyUrl(): Promise<void> {
    await this.clipboard.copyToClipboard(this.feedUrl());
    this.copyMessage.set(this.clipboard.clipboardText() === this.feedUrl()
      ? "Subscription link copied. Paste it into your calendar in the step described above."
      : "Open Manual setup below, select the address and copy it manually.");
  }
}
