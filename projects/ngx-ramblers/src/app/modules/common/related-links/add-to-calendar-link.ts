import { Component, inject, Input, OnChanges } from "@angular/core";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { faCalendarDay, faCalendarPlus } from "@fortawesome/free-solid-svg-icons";
import { faGoogle, faMicrosoft } from "@fortawesome/free-brands-svg-icons";
import { IconDefinition } from "@fortawesome/fontawesome-svg-core";
import { isBrowser } from "es-toolkit";
import { NgxLoggerLevel } from "ngx-logger";
import {
  calendarAppLabel,
  calendarAppsForDevice,
  calendarEventFromGroupEvent,
  calendarHrefFor,
  deviceKindFromUserAgent
} from "../../../functions/calendar-add";
import { ExtendedGroupEvent } from "../../../models/group-event.model";
import { CalendarApp, CalendarClientHints, CalendarPreviewEvent, DeviceKind } from "../../../models/inbox.model";
import { LoggerFactory } from "../../../services/logger-factory.service";
import { StringUtilsService } from "../../../services/string-utils.service";
import { ContactAction, ContactActionDropdownComponent } from "../contact-action-dropdown/contact-action-dropdown";
import { RelatedLinkComponent } from "./related-link";

@Component({
  selector: "app-add-to-calendar-link",
  imports: [FontAwesomeModule, RelatedLinkComponent, ContactActionDropdownComponent],
  template: `
    @if (choosableCalendarApps().length > 0) {
      <div app-related-link [mediaWidth]="mediaWidth" class="col-sm-12">
        <fa-icon title [icon]="faCalendarPlus" class="fa-icon"></fa-icon>
        <app-contact-action-dropdown content [actions]="calendarActions()">Add to calendar</app-contact-action-dropdown>
      </div>
    }
  `
})
export class AddToCalendarLinkComponent implements OnChanges {
  private logger = inject(LoggerFactory).createLogger("AddToCalendarLinkComponent", NgxLoggerLevel.ERROR);
  private stringUtils = inject(StringUtilsService);
  @Input() event: ExtendedGroupEvent;
  @Input() eventUrl: string;
  @Input() organiser: string;
  @Input() organiserPhone: string;
  @Input() organiserEmail: string;
  @Input() mediaWidth: number;
  protected readonly faCalendarPlus = faCalendarPlus;
  private readonly deviceKind: DeviceKind = deviceKindFromUserAgent(
    isBrowser() ? navigator.userAgent : "",
    isBrowser() ? navigator.platform : null
  );
  private readonly calendarApps: CalendarApp[] = calendarAppsForDevice(this.deviceKind);
  private readonly calendarClientHints: CalendarClientHints = {
    userAgent: isBrowser() ? navigator.userAgent : "",
    origin: isBrowser() ? window.location.origin : null
  };
  private calendarEvent: CalendarPreviewEvent | null = null;

  ngOnChanges(): void {
    this.calendarEvent = calendarEventFromGroupEvent(this.event ?? null);
    if (this.calendarEvent) {
      this.calendarEvent.url = this.eventUrl || this.calendarEvent.url;
      this.calendarEvent.organiser = this.organiser || null;
      this.calendarEvent.organiserPhone = this.organiserPhone || null;
      this.calendarEvent.organiserEmail = this.organiserEmail || null;
    }
    this.logger.info("ngOnChanges:calendarEvent:", this.calendarEvent);
  }

  calendarDownloadUrl(): string | null {
    return this.event?.id ? `/api/calendar/event/${this.event.id}` : null;
  }

  calendarHref(app: CalendarApp): string | null {
    return calendarHrefFor(app, this.calendarEvent, this.calendarDownloadUrl(), this.calendarClientHints);
  }

  choosableCalendarApps(): CalendarApp[] {
    if (!this.calendarDownloadUrl()) {
      return [];
    } else {
      return this.calendarApps.filter(app => !!this.calendarHref(app));
    }
  }

  calendarActions(): ContactAction[] {
    return this.choosableCalendarApps().map(app => ({
      label: calendarAppLabel(app),
      icon: this.calendarIcon(app),
      tooltip: `${calendarAppLabel(app)} for this ${this.eventTypeLabel()}`,
      href: this.calendarHref(app),
      target: app === CalendarApp.LOCAL ? "_self" : "_blank"
    }));
  }

  eventTypeLabel(): string {
    return (this.stringUtils.asTitle(this.event?.groupEvent?.item_type) || "Event").toLowerCase();
  }

  private calendarIcon(app: CalendarApp): IconDefinition {
    if (app === CalendarApp.GOOGLE) {
      return faGoogle;
    } else if (app === CalendarApp.OUTLOOK) {
      return faMicrosoft;
    } else {
      return faCalendarDay;
    }
  }
}
