import { EmailComposerSessionService } from "../../services/email-composer/email-composer-session.service";
import { BrandingMode, ComposerFragment, ComposerFragmentKind, DateInputMode, EmailCompositionKind, EventInclusionMode, SectionDividerStyle } from "../../models/email-composer.model";
import { EmailComposerFragmentsService } from "../../services/email-composer/email-composer-fragments.service";
import { applyMediaSelection, clampMediaIndex } from "../../functions/email-composer-event-media";
import { inject } from "@angular/core";
import { kebabCase } from "es-toolkit/compat";
import { NgxLoggerLevel } from "ngx-logger";
import { Logger, LoggerFactory } from "../../services/logger-factory.service";
import { markEventsNewSinceLastNewsletter } from "../../functions/newsletter-window";
import { StringUtilsService } from "../../services/string-utils.service";
import { DateUtilsService } from "../../services/date-utils.service";
import { CommitteeQueryService } from "../../services/committee/committee-query.service";
import { WalksAndEventsService } from "../../services/walks-and-events/walks-and-events.service";
import { GroupEventSummary } from "../../models/committee.model";
import { RamblersEventType } from "../../models/ramblers-walks-manager";
import { MediaQueryService } from "../../services/committee/media-query.service";
import { CommitteeDisplayService } from "../../pages/committee/committee-display.service";
import { ExtendedGroupEvent } from "../../models/group-event.model";
import { eventSlug } from "../../functions/walks/event-slug";
import { DateValue } from "../../models/date.model";
import { DateRange, dateRangeSliderBounds } from "../../components/date-range-slider/date-range-slider";
import { StoredValue } from "../../models/ui-actions";
import { AdvancedSearchPreset, createAllTimePreset, createFuturePreset, createPastPreset } from "../../models/search.model";
import { DateTime } from "luxon";
import { Injectable } from "@angular/core";


@Injectable()
export class EmailComposerEventSelectionService {
  logger: Logger = inject(LoggerFactory).createLogger("EmailComposer", NgxLoggerLevel.ERROR);

  session = inject(EmailComposerSessionService);

  dateUtils = inject(DateUtilsService);

  committeeQueryService = inject(CommitteeQueryService);

  walksAndEventsService = inject(WalksAndEventsService);

  committeeDisplayService = inject(CommitteeDisplayService);

  mediaQueryService = inject(MediaQueryService);

  stringUtils = inject(StringUtilsService);

  fragmentEditor = inject(EmailComposerFragmentsService);

  ensureGroupEventsFilter(): void {
      if (!(this.session.state.groupEventsFilter)) {
        const today = this.dateUtils.dateTimeNowNoTime();
        this.session.state.groupEventsFilter = {
          search: null,
          selectAll: true,
          fromDate: this.dateUtils.asDateValue(today.toMillis()),
          toDate: this.dateUtils.asDateValue(today.plus({weeks: 2}).toMillis()),
          includeImage: true,
          includeContact: true,
          includeDescription: true,
          includeLocation: true,
          includeWalks: true,
          includeSocialEvents: true,
          includeCommitteeEvents: true
        };
        this.recomputeSliderBoundsFromCurrentRange();
        this.selectedDateRangePreset = this.matchPresetToCurrentRange();
      }
    }

  async loadSingleEvent(eventId: string): Promise<void> {
      const event = await this.queryEventByIdSafely(eventId);
      this.session.state.singleEvent = event;
      if (event && !this.session.state.subject) {
        this.session.state.subject = event.groupEvent?.title ?? this.session.state.subject;
        this.session.state.showTitle = false;
      }
      this.session.state.groupEvents = event ? [this.eventToSummary(event)] : [];
    }

  async queryEventByIdSafely(eventId: string): Promise<ExtendedGroupEvent | null> {
      try {
        return await this.walksAndEventsService.queryById(eventId);
      } catch (error) {
        this.logger.error("queryEventByIdSafely failed", error);
        return null;
      }
    }

  eventToSummary(event: ExtendedGroupEvent): GroupEventSummary {
      return {
        id: event.id || event?.groupEvent?.id,
        ramblersEventType: event?.groupEvent?.item_type || RamblersEventType.GROUP_WALK,
        slug: eventSlug(event),
        selected: true,
        eventType: this.committeeDisplayService.groupEventType(event),
        eventDate: event?.groupEvent?.start_date_time
          ? this.dateUtils.asDateTime(event.groupEvent.start_date_time).toMillis()
          : null,
        eventTime: event?.groupEvent?.start_date_time
          ? this.dateUtils.asString(event.groupEvent.start_date_time, undefined, this.dateUtils.formats.displayTime)
          : null,
        location: (event?.groupEvent?.start_location || event?.groupEvent?.location)?.description,
        postcode: (event?.groupEvent?.start_location || event?.groupEvent?.location)?.postcode,
        title: event?.groupEvent?.title || "Awaiting " + this.stringUtils.asTitle(event?.groupEvent?.item_type ?? "event") + " details",
        description: event?.groupEvent?.description,
        contactName: event?.fields?.contactDetails?.displayName,
        contactPhone: event?.fields?.contactDetails?.phone,
        contactEmail: event?.fields?.contactDetails?.email,
        image: this.mediaQueryService.imageUrlFrom(event?.groupEvent),
        media: event?.groupEvent?.media ?? [],
        selectedMediaIndex: 0
      } as GroupEventSummary;
    }

  async populateGroupEvents(): Promise<void> {
      if (!(this.session.state.eventInclusion !== EventInclusionMode.AUTO_INCLUDE)) {
        if (!this.session.state.groupEventsFilter) {
          this.ensureGroupEventsFilter();
        }
        try {
          const events = await this.committeeQueryService.groupEvents(this.session.state.groupEventsFilter!);
          const priorById = new Map(this.session.state.groupEvents.map(item => [item.id, item]));
          this.session.state.groupEvents = this.markNewSinceLastNewsletter(events.map(event => this.mergePriorSelection(event, priorById.get(event.id))));
        } catch (error) {
          this.logger.error("populateGroupEvents failed", error);
        }
      }
    }

  markNewSinceLastNewsletter(events: GroupEventSummary[]): GroupEventSummary[] {
      const settings = this.session.state.newsletter;
      const canMark = this.session.newsletterMode() && !!settings?.markNewEvents && !!settings?.previousNewsletterId;
      return markEventsNewSinceLastNewsletter(events, canMark ? settings.previouslyAnnouncedEventIds : null);
    }

  setEventInclusionMode(mode: EventInclusionMode): void {
      this.session.state.eventInclusion = mode;
      if (mode === EventInclusionMode.AUTO_INCLUDE) {
        this.resetGroupEventsFilterToDefaultRange();
        void this.populateGroupEvents();
        this.addEventsFragment(true);
      } else if (mode === EventInclusionMode.SINGLE_EVENT && this.session.state.singleEvent) {
        this.session.state.groupEvents = [this.eventToSummary(this.session.state.singleEvent)];
        this.addEventsFragment(true);
      }
      this.session.syncStateToUrl({[StoredValue.EVENT_INCLUSION]: mode});
    }

  resetGroupEventsFilterToDefaultRange(): void {
      const today = this.dateUtils.dateTimeNowNoTime();
      this.session.state.groupEventsFilter = {
        search: null,
        selectAll: true,
        fromDate: this.dateUtils.asDateValue(today.toMillis()),
        toDate: this.dateUtils.asDateValue(today.plus({weeks: 2}).toMillis()),
        includeImage: this.session.state.groupEventsFilter?.includeImage ?? true,
        includeContact: this.session.state.groupEventsFilter?.includeContact ?? true,
        includeDescription: this.session.state.groupEventsFilter?.includeDescription ?? true,
        includeLocation: this.session.state.groupEventsFilter?.includeLocation ?? true,
        includeWalks: this.session.state.groupEventsFilter?.includeWalks ?? true,
        includeSocialEvents: this.session.state.groupEventsFilter?.includeSocialEvents ?? true,
        includeCommitteeEvents: this.session.state.groupEventsFilter?.includeCommitteeEvents ?? true
      };
      this.recomputeSliderBoundsFromCurrentRange();
      this.selectedDateRangePreset = this.matchPresetToCurrentRange();
    }

  onFromDateChange(dateValue: DateValue): void {
      if (!(!this.session.state.groupEventsFilter)) {
        this.session.state.groupEventsFilter.fromDate = dateValue;
        this.selectedDateRangePreset = this.matchPresetToCurrentRange();
        this.session.syncStateToUrl({[StoredValue.DATE_FROM]: dateValue?.value?.toString() ?? null});
        void this.populateGroupEvents();
      }
    }

  onToDateChange(dateValue: DateValue): void {
      if (!(!this.session.state.groupEventsFilter)) {
        this.session.state.groupEventsFilter.toDate = dateValue;
        this.selectedDateRangePreset = this.matchPresetToCurrentRange();
        this.session.syncStateToUrl({[StoredValue.DATE_TO]: dateValue?.value?.toString() ?? null});
        void this.populateGroupEvents();
      }
    }

  dateInputMode: DateInputMode = DateInputMode.Slider;

  eventSliderMinDate: DateTime = this.dateUtils.dateTimeNow().startOf("day").minus({months: 3});

  eventSliderMaxDate: DateTime = this.dateUtils.dateTimeNow().startOf("day").plus({years: 2});

  setDateInputMode(mode: DateInputMode): void {
      this.dateInputMode = mode;
      if (mode === DateInputMode.Slider) {
        this.recomputeSliderBoundsFromCurrentRange();
      }
    }

  eventSliderRangeValue: DateRange | null = null;

  eventSliderRange(): DateRange | null {
      const filter = this.session.state.groupEventsFilter;
      if (!filter?.fromDate?.value || !filter?.toDate?.value) {
        this.eventSliderRangeValue = null;
      } else if (!this.eventSliderRangeValue || this.eventSliderRangeValue.from !== filter.fromDate.value || this.eventSliderRangeValue.to !== filter.toDate.value) {
        this.eventSliderRangeValue = {from: filter.fromDate.value, to: filter.toDate.value};
      }
      return this.eventSliderRangeValue;
    }

  onEventDateRangeChange(range: DateRange): void {
      if (!(!this.session.state.groupEventsFilter)) {
        this.session.state.groupEventsFilter.fromDate = this.dateUtils.asDateValue(range.from);
        this.session.state.groupEventsFilter.toDate = this.dateUtils.asDateValue(range.to);
        this.selectedDateRangePreset = this.matchPresetToCurrentRange();
        this.session.syncStateToUrl({
          [StoredValue.DATE_FROM]: range.from.toString(),
          [StoredValue.DATE_TO]: range.to.toString()
        });
        void this.populateGroupEvents();
      }
    }

  rescaleSliderToRange(fromMillis: number, toMillis: number): void {
      const {
        minDate,
        maxDate
      } = dateRangeSliderBounds(this.dateUtils.asDateTime(fromMillis), this.dateUtils.asDateTime(toMillis), 0.25, 1);
      this.eventSliderMinDate = minDate;
      this.eventSliderMaxDate = maxDate;
    }

  recomputeSliderBoundsFromCurrentRange(): void {
      const filter = this.session.state.groupEventsFilter;
      if (!(!filter?.fromDate?.value || !filter?.toDate?.value)) {
        this.rescaleSliderToRange(filter.fromDate.value, filter.toDate.value);
      }
    }

  dateRangePresetOptions: AdvancedSearchPreset[] = [
      createFuturePreset("Next 7 days", {days: 7}),
      createFuturePreset("Next 14 days", {days: 14}),
      createFuturePreset("Next 30 days", {days: 30}),
      createFuturePreset("Next 3 months", {months: 3}),
      createFuturePreset("Next 6 months", {months: 6}),
      createPastPreset("Past 30 days", {days: 30}),
      createPastPreset("Past 3 months", {months: 3}),
      createAllTimePreset("All upcoming", this.dateUtils.dateTimeNow().startOf("day"), this.dateUtils.dateTimeNow().plus({years: 2}).endOf("day"))
    ];

  customDateRangePreset: AdvancedSearchPreset = {
      label: "Custom",
      range: () => ({
        from: this.session.state.groupEventsFilter?.fromDate?.value ?? this.dateUtils.dateTimeNow().startOf("day").toMillis(),
        to: this.session.state.groupEventsFilter?.toDate?.value ?? this.dateUtils.dateTimeNow().startOf("day").toMillis()
      })
    };

  dateRangePresetItems: AdvancedSearchPreset[] = [...this.dateRangePresetOptions, this.customDateRangePreset];

  selectedDateRangePreset: AdvancedSearchPreset | null = null;

  onDateRangePresetChange(preset: AdvancedSearchPreset | null): void {
      if (!(!preset || !this.session.state.groupEventsFilter)) {
        if (preset === this.customDateRangePreset) {
        } else {
          const range = preset.range();
          this.session.state.groupEventsFilter.fromDate = this.dateUtils.asDateValue(range.from);
          this.session.state.groupEventsFilter.toDate = this.dateUtils.asDateValue(range.to);
          this.rescaleSliderToRange(range.from, range.to);
          this.session.syncStateToUrl({
            [StoredValue.DATE_RANGE_PRESET]: this.stringUtils.kebabCase(preset.label),
            [StoredValue.DATE_FROM]: range.from.toString(),
            [StoredValue.DATE_TO]: range.to.toString()
          });
          void this.populateGroupEvents();
        }
      }
    }

  matchPresetToCurrentRange(): AdvancedSearchPreset | null {
      if (!this.session.state.groupEventsFilter) {
        return null;
      } else {
        const fromMillis = this.session.state.groupEventsFilter.fromDate?.value;
        const toMillis = this.session.state.groupEventsFilter.toDate?.value;
        if (!fromMillis || !toMillis) {
          return null;
        } else {
          const tolerance = 24 * 60 * 60 * 1000;
          const exactMatch = this.dateRangePresetOptions.find(preset => {
            const range = preset.range();
            return Math.abs(range.from - fromMillis) <= tolerance && Math.abs(range.to - toMillis) <= tolerance;
          });
          return exactMatch ?? this.customDateRangePreset;
        }
      }
    }

  onGroupEventSelectionChanged(): void {
      if (this.selectedGroupEventCount() > 0) {
        this.addEventsFragment(true);
      }
    }

  selectedGroupEventCount(): number {
      return this.session.state.groupEvents.filter(event => event.selected).length;
    }

  selectedGroupEventsList(): GroupEventSummary[] {
      return this.session.state.groupEvents.filter(event => event.selected);
    }

  mergePriorSelection(event: GroupEventSummary, prior?: GroupEventSummary): GroupEventSummary {
      const merged: GroupEventSummary = {
        ...event,
        selected: prior?.selected ?? this.session.state.groupEventsFilter!.selectAll
      };
      applyMediaSelection(merged, clampMediaIndex(merged, prior?.selectedMediaIndex));
      return merged;
    }

  addEventsFragment(notifyAdded = false): void {
      if (!this.session.eventsStepOmitted()) {
        if (this.fragmentEditor.hasFragmentKindAtTopLevel(this.session.state, ComposerFragmentKind.EVENTS)) {
          this.fragmentEditor.expandedFragmentIds.add("events");
        } else {
          const list = this.session.state.fragmentOrder ?? [];
          const signoffIdx = list.findIndex(f => f.kind === ComposerFragmentKind.SIGNOFF);
          const insertAt = signoffIdx >= 0 ? signoffIdx : list.length;
          const newFragment: ComposerFragment = {
            kind: ComposerFragmentKind.EVENTS,
            id: "events",
            dividerAfter: this.session.state.eventsDividerAfter ?? SectionDividerStyle.THIN_YELLOW
          };
          this.session.state.fragmentOrder = [...list.slice(0, insertAt), newFragment, ...list.slice(insertAt)];
          this.fragmentEditor.expandedFragmentIds.add(newFragment.id);
          if (notifyAdded) {
            this.session.notify.success({
              title: "Events added to the email",
              message: "An Events list has been added on the Content step so the events you picked will go in the message."
            });
          }
        }
      }
    }
}
