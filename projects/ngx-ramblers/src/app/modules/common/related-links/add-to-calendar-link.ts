import { Component, inject, Input, OnChanges } from "@angular/core";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { faCalendarPlus } from "@fortawesome/free-solid-svg-icons";
import { NgxLoggerLevel } from "ngx-logger";
import {
  browserCalendarApps,
  browserCalendarClientHints,
  calendarAppIcon,
  calendarAppLabel,
  calendarEventFromGroupEvent,
  calendarHrefFor
} from "../../../functions/calendar-add";
import { ExtendedGroupEvent } from "../../../models/group-event.model";
import { CalendarApp, CalendarClientHints, CalendarPreviewEvent } from "../../../models/inbox.model";
import { WalkDisplayService } from "../../../pages/walks/walk-display.service";
import { LoggerFactory } from "../../../services/logger-factory.service";
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
  private display = inject(WalkDisplayService);
  @Input() event: ExtendedGroupEvent;
  @Input() eventUrl: string;
  @Input() organiser: string;
  @Input() organiserPhone: string;
  @Input() organiserEmail: string;
  @Input() mediaWidth: number;
  protected readonly faCalendarPlus = faCalendarPlus;
  private readonly calendarApps: CalendarApp[] = browserCalendarApps();
  private readonly calendarClientHints: CalendarClientHints = browserCalendarClientHints();
  private calendarEvent: CalendarPreviewEvent | null = null;

  ngOnChanges(): void {
    this.calendarEvent = calendarEventFromGroupEvent(this.event ?? null);
    if (this.calendarEvent) {
      this.calendarEvent.url = this.eventUrl || this.calendarEvent.url;
      this.calendarEvent.organiser = this.boundOrDerived(this.organiser, this.calendarEvent.organiser);
      this.calendarEvent.organiserPhone = this.boundOrDerived(this.organiserPhone, this.calendarEvent.organiserPhone);
      this.calendarEvent.organiserEmail = this.boundOrDerived(this.organiserEmail, this.calendarEvent.organiserEmail);
    }
    this.logger.info("ngOnChanges:calendarEvent:", this.calendarEvent);
  }

  private boundOrDerived(bound: string | null | undefined, derived: string | null): string | null {
    if (bound === undefined) {
      return derived;
    } else {
      return bound || null;
    }
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
      icon: calendarAppIcon(app),
      tooltip: `${calendarAppLabel(app)} for this ${this.eventTypeLabel()}`,
      href: this.calendarHref(app),
      target: app === CalendarApp.LOCAL ? "_self" : "_blank"
    }));
  }

  eventTypeLabel(): string {
    return this.display.eventTypeTitle(this.event).toLowerCase();
  }
}
