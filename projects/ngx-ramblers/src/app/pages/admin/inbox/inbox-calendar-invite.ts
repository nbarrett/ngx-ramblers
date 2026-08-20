import { CommonModule } from "@angular/common";
import { HttpClient, HttpErrorResponse } from "@angular/common/http";
import { isString } from "es-toolkit/compat";
import { Component, inject, Input } from "@angular/core";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { faGoogle, faMicrosoft } from "@fortawesome/free-brands-svg-icons";
import {
  faCalendarDays,
  faCalendarPlus,
  faCheck,
  faCircleCheck,
  faCircleQuestion,
  faTriangleExclamation,
  faXmark
} from "@fortawesome/free-solid-svg-icons";
import { firstValueFrom } from "rxjs";
import { isBrowser } from "es-toolkit";
import { NgxLoggerLevel } from "ngx-logger";
import { UIDateFormat } from "../../../models/date-format.model";
import {
  CalendarApp,
  CalendarClientHints,
  CalendarInvite,
  CalendarMethod,
  CalendarPreviewEvent,
  CalendarRsvpStatus,
  DeviceKind,
  InboxAttachment,
  InboxMessage
} from "../../../models/inbox.model";
import { calendarAppLabel, calendarAppsForDevice, calendarHrefFor, deviceKindFromUserAgent } from "../../../functions/calendar-add";
import { calendarInviteCanRsvp, isCalendarFile, parseIcsCalendar } from "../../../functions/ics-calendar";
import { DateUtilsService } from "../../../services/date-utils.service";
import { InboxService } from "../../../services/inbox/inbox.service";
import { Logger, LoggerFactory } from "../../../services/logger-factory.service";
import { UrlService } from "../../../services/url.service";
import { ThumbnailHeadingFrameComponent } from "../../../modules/common/thumbnail-heading-frame/thumbnail-heading-frame";

@Component({
  selector: "app-inbox-calendar-invite",
  imports: [CommonModule, FontAwesomeModule, ThumbnailHeadingFrameComponent],
  styles: [`
    :host
      display: block
      margin-bottom: 1rem
    .inbox-calendar-when
      font-weight: 700
    .inbox-calendar-rsvp-buttons
      display: flex
      flex-wrap: wrap
      gap: 0.5rem
  `],
  template: `
    @if (inviteEvent) {
      <div class="d-flex align-items-start gap-2 mb-3">
        <fa-icon [icon]="faCalendarDays" class="mt-1"/>
        <div>
          @if (eventWhen(inviteEvent); as when) {
            <div class="inbox-calendar-when">{{ when }}</div>
          }
          <div>{{ inviteEvent.title || "Calendar event" }}</div>
          @if (inviteEvent.location) {
            <div class="text-muted">{{ inviteEvent.location }}</div>
          }
        </div>
      </div>
      @if (inviteEvent.status === 'CANCELLED' || invite?.method === CalendarMethod.CANCEL) {
        <div class="alert alert-warning d-flex align-items-start">
          <fa-icon [icon]="faTriangleExclamation" class="me-2 mt-1"/>
          <div>
            <strong>Cancelled</strong>
            <div>This meeting has been cancelled.</div>
          </div>
        </div>
      } @else if (canRsvp) {
        <app-thumbnail-heading-frame heading="RSVP to this event" [compact]="true">
          @if (replyError) {
            <div class="alert alert-danger d-flex align-items-start mb-3">
              <fa-icon [icon]="faTriangleExclamation" class="me-2 mt-1"/>
              <div>
                <strong>Could not send your reply</strong>
                <div>{{ replyError }}</div>
              </div>
            </div>
          }
          @if (currentRsvp; as rsvp) {
            <div class="alert alert-success d-flex align-items-start mb-3">
              <fa-icon [icon]="faCircleCheck" class="me-2 mt-1"/>
              <div>
                <strong>{{ rsvpTitle(rsvp) }}</strong>
                <div>{{ rsvpDetail(rsvp) }}</div>
              </div>
            </div>
          }
          <div class="inbox-calendar-rsvp-buttons mb-3">
            <button type="button" class="btn btn-success" [disabled]="busy" (click)="reply(CalendarRsvpStatus.ACCEPTED)">
              <fa-icon [icon]="faCheck" class="me-2"/>Accept
            </button>
            <button type="button" class="btn btn-quiet" [disabled]="busy" (click)="reply(CalendarRsvpStatus.TENTATIVE)">
              <fa-icon [icon]="faCircleQuestion" class="me-2"/>Tentative
            </button>
            <button type="button" class="btn btn-danger" [disabled]="busy" (click)="reply(CalendarRsvpStatus.DECLINED)">
              <fa-icon [icon]="faXmark" class="me-2"/>Decline
            </button>
          </div>
          @if (currentRsvp === CalendarRsvpStatus.ACCEPTED || currentRsvp === CalendarRsvpStatus.TENTATIVE) {
            <div class="d-flex flex-wrap gap-2">
              @for (app of calendarApps; track app) {
                @if (calendarHref(app); as href) {
                  <a class="btn" [class.btn-primary]="calendarIsPrimary(app)" [class.btn-quiet]="!calendarIsPrimary(app)"
                     [href]="href"
                     [attr.target]="app === CalendarApp.LOCAL ? null : '_blank'"
                     [attr.rel]="app === CalendarApp.LOCAL ? null : 'noopener'">
                    <fa-icon [icon]="calendarIcon(app)" class="me-2"/>{{ calendarLabel(app) }}
                  </a>
                }
              }
            </div>
          }
        </app-thumbnail-heading-frame>
      } @else {
        <div class="d-flex flex-wrap gap-2">
          @for (app of calendarApps; track app) {
            @if (calendarHref(app); as href) {
              <a class="btn" [class.btn-primary]="calendarIsPrimary(app)" [class.btn-quiet]="!calendarIsPrimary(app)"
                 [href]="href"
                 [attr.target]="app === CalendarApp.LOCAL ? null : '_blank'"
                 [attr.rel]="app === CalendarApp.LOCAL ? null : 'noopener'">
                <fa-icon [icon]="calendarIcon(app)" class="me-2"/>{{ calendarLabel(app) }}
              </a>
            }
          }
        </div>
      }
    }
  `
})
export class InboxCalendarInviteComponent {
  private logger: Logger = inject(LoggerFactory).createLogger("InboxCalendarInviteComponent", NgxLoggerLevel.ERROR);
  private http = inject(HttpClient);
  private inboxService = inject(InboxService);
  private urlService = inject(UrlService);
  private dateUtils = inject(DateUtilsService);
  protected readonly CalendarRsvpStatus = CalendarRsvpStatus;
  protected readonly CalendarMethod = CalendarMethod;
  protected readonly CalendarApp = CalendarApp;
  protected readonly faCalendarDays = faCalendarDays;
  protected readonly faCalendarPlus = faCalendarPlus;
  protected readonly faCheck = faCheck;
  protected readonly faCircleCheck = faCircleCheck;
  protected readonly faCircleQuestion = faCircleQuestion;
  protected readonly faTriangleExclamation = faTriangleExclamation;
  protected readonly faXmark = faXmark;
  protected readonly faGoogle = faGoogle;
  protected readonly faMicrosoft = faMicrosoft;
  protected readonly deviceKind: DeviceKind = deviceKindFromUserAgent(
    isBrowser() ? navigator.userAgent : "",
    isBrowser() ? navigator.platform : null
  );
  protected readonly calendarApps: CalendarApp[] = calendarAppsForDevice(this.deviceKind);
  private readonly calendarClientHints: CalendarClientHints = {
    userAgent: isBrowser() ? navigator.userAgent : "",
    origin: isBrowser() ? window.location.origin : null
  };

  protected invite: CalendarInvite | null = null;
  protected inviteEvent: CalendarPreviewEvent | null = null;
  protected canRsvp = false;
  protected currentRsvp: CalendarRsvpStatus | null = null;
  protected busy = false;
  protected replyError: string | null = null;
  private currentMessage: InboxMessage | null = null;
  private calendarFileUrl: string | null = null;

  @Input() set message(value: InboxMessage | null) {
    this.currentMessage = value;
    this.currentRsvp = value?.calendarRsvp ?? null;
    this.replyError = null;
    void this.loadInvite(value);
  }

  private async loadInvite(message: InboxMessage | null): Promise<void> {
    const attachment = (message?.attachments ?? []).find(item => isCalendarFile(item.filename, item.contentType) && item.s3Key) as InboxAttachment | undefined;
    if (!attachment?.s3Key) {
      this.invite = null;
      this.inviteEvent = null;
      this.canRsvp = false;
      this.calendarFileUrl = null;
    } else {
      try {
        const url = this.urlService.sameOriginUrl(this.urlService.resourceRelativePathForAWSFileName(attachment.s3Key));
        this.calendarFileUrl = url;
        const text = await firstValueFrom(this.http.get(url, {responseType: "text"}));
        const parsed = parseIcsCalendar(text);
        this.invite = parsed;
        this.inviteEvent = parsed.events[0] ?? null;
        this.canRsvp = calendarInviteCanRsvp(parsed);
      } catch (error) {
        this.logger.error("calendar invite preview failed for", attachment, error);
        this.invite = null;
        this.inviteEvent = null;
        this.canRsvp = false;
        this.calendarFileUrl = null;
      }
    }
  }

  async reply(status: CalendarRsvpStatus): Promise<void> {
    const message = this.currentMessage;
    if (message?.threadId && !this.busy) {
      this.busy = true;
      this.replyError = null;
      try {
        const response = await this.inboxService.sendCalendarReply(message.threadId, {messageId: message.messageId, status});
        this.currentRsvp = response.status;
        message.calendarRsvp = response.status;
      } catch (error) {
        this.logger.error("calendar RSVP failed", error);
        this.replyError = calendarReplyErrorMessage(error);
      } finally {
        this.busy = false;
      }
    }
  }

  eventWhen(event: CalendarPreviewEvent): string | null {
    if (!event.startsAt) {
      return null;
    } else if (event.allDay) {
      return this.dateUtils.displayDate(event.startsAt);
    } else if (event.endsAt) {
      const startDay = this.dateUtils.asString(event.startsAt, undefined, UIDateFormat.YEAR_MONTH_DAY);
      const endDay = this.dateUtils.asString(event.endsAt, undefined, UIDateFormat.YEAR_MONTH_DAY);
      return startDay === endDay
        ? `${this.dateUtils.asString(event.startsAt, undefined, UIDateFormat.DISPLAY_DATE_AT_TIME)} - ${this.dateUtils.asString(event.endsAt, undefined, UIDateFormat.DISPLAY_TIME)}`
        : `${this.dateUtils.asString(event.startsAt, undefined, UIDateFormat.DISPLAY_DATE_AT_TIME)} - ${this.dateUtils.asString(event.endsAt, undefined, UIDateFormat.DISPLAY_DATE_AT_TIME)}`;
    } else {
      return this.dateUtils.asString(event.startsAt, undefined, UIDateFormat.DISPLAY_DATE_AT_TIME);
    }
  }

  rsvpTitle(status: CalendarRsvpStatus): string {
    if (status === CalendarRsvpStatus.ACCEPTED) {
      return "Accepted";
    } else if (status === CalendarRsvpStatus.TENTATIVE) {
      return "Tentative";
    } else if (status === CalendarRsvpStatus.DECLINED) {
      return "Declined";
    } else {
      return "";
    }
  }

  rsvpDetail(status: CalendarRsvpStatus): string {
    if (status === CalendarRsvpStatus.ACCEPTED) {
      return "The organiser has been told you will attend. Add it to your own calendar below if you want it there too.";
    } else if (status === CalendarRsvpStatus.TENTATIVE) {
      return "The organiser has been told you might attend. Add it to your own calendar below if you want it there too.";
    } else if (status === CalendarRsvpStatus.DECLINED) {
      return "The organiser has been told you will not attend.";
    } else {
      return "";
    }
  }

  calendarLabel(app: CalendarApp): string {
    return calendarAppLabel(app);
  }

  calendarIcon(app: CalendarApp) {
    if (app === CalendarApp.GOOGLE) {
      return this.faGoogle;
    } else if (app === CalendarApp.OUTLOOK) {
      return this.faMicrosoft;
    } else {
      return this.faCalendarPlus;
    }
  }

  calendarIsPrimary(app: CalendarApp): boolean {
    return this.calendarApps.find(candidate => !!this.calendarHref(candidate)) === app;
  }

  calendarHref(app: CalendarApp): string | null {
    return calendarHrefFor(app, this.inviteEvent, this.calendarFileUrl, this.calendarClientHints);
  }
}

function calendarReplyErrorMessage(error: unknown): string {
  const httpError = error as HttpErrorResponse;
  const apiError = httpError?.error?.error;
  if (isString(apiError)) {
    return apiError;
  } else if (apiError?.message) {
    return apiError.message;
  } else {
    return "The organiser could not be notified. Try again.";
  }
}
