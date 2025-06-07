import { inject, Injectable } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { LocationDetails, RamblersEventType } from "../../models/ramblers-walks-manager";
import { LinkSource, LinkWithSource, WalkType } from "../../models/walk.model";
import { WalkDisplayService } from "../../pages/walks/walk-display.service";
import { DateUtilsService } from "../date-utils.service";
import { Logger, LoggerFactory } from "../logger-factory.service";
import { ExtendedFields, ExtendedGroupEvent, GroupEvent } from "../../models/group-event.model";
import { SocialEvent, Walk } from "../../models/deprecated";
import { WalksLocalLegacyService } from "../walks/walks-local-legacy.service";
import { Time } from "@angular/common";
import moment from "moment-timezone";
import { LegacyDistanceValidationService } from "./legacy-distance-validation.service";
import { LegacyAscentValidationService } from "./legacy-ascent-validation.service";
import { StringUtilsService } from "../string-utils.service";
import { UrlService } from "../url.service";
import { RamblersWalksAndEventsService } from "../walks/ramblers-walks-and-events.service";
import { DateCriteria } from "../../models/api-request.model";
import { WalksQueryService } from "../walks/walks-query.service";
import { WalksAndEventsLocalService } from "../walks/walks-and-events-local.service";
import { WalksConfigService } from "../system/walks-config.service";
import { WalksConfig } from "../../models/walk-notification.model";
import groupBy from "lodash-es/groupBy";
import { sortBy } from "../../functions/arrays";
import last from "lodash-es/last";

@Injectable({
  providedIn: "root"
})
export class EventsMigrationService {

  private logger: Logger = inject(LoggerFactory).createLogger("EventsMigrationService", NgxLoggerLevel.INFO);
  private dateUtils: DateUtilsService = inject(DateUtilsService);
  private stringUtilsService: StringUtilsService = inject(StringUtilsService);
  private walksLocalLegacyService: WalksLocalLegacyService = inject(WalksLocalLegacyService);
  private legacyDistanceValidationService: LegacyDistanceValidationService = inject(LegacyDistanceValidationService);
  private legacyAscentValidationService: LegacyAscentValidationService = inject(LegacyAscentValidationService);
  private walkDisplayService: WalkDisplayService = inject(WalkDisplayService);
  private walksQueryService: WalksQueryService = inject(WalksQueryService);
  private walksConfigService = inject(WalksConfigService);
  private ramblersWalksAndEventsService: RamblersWalksAndEventsService = inject(RamblersWalksAndEventsService);
  private walksAndEventsLocalService: WalksAndEventsLocalService = inject(WalksAndEventsLocalService);
  private urlService: UrlService = inject(UrlService);
  private walksConfig: WalksConfig;

  constructor() {
    this.walksConfigService.events().subscribe(walksConfig => this.walksConfig = walksConfig);
  }


  isWalk = (event: Walk | SocialEvent): event is Walk => "walkDate" in event;


  toExtendedGroupEvent(walkOrSocialEvent: Walk | SocialEvent, ramblersWalks: ExtendedGroupEvent[]): ExtendedGroupEvent {
    const ramblersWalk: ExtendedGroupEvent = this.isWalk(walkOrSocialEvent) ? ramblersWalks.find(item => item.groupEvent.id === walkOrSocialEvent.ramblersWalkId) : null;
    if (ramblersWalk) {
      this.logger.info("Found existing Ramblers Walk for walkOrSocialEvent.ramblersWalkId:", ramblersWalk.groupEvent.id, "ramblersWalk:", ramblersWalk, "start_date_time:", ramblersWalk.groupEvent.start_date_time);
    }
    const units = this.isWalk(walkOrSocialEvent) ? this.legacyDistanceValidationService.parse(walkOrSocialEvent) : null;
    const ascent = this.isWalk(walkOrSocialEvent) ? this.legacyAscentValidationService.parse(walkOrSocialEvent) : null;
    const title = this.isWalk(walkOrSocialEvent) ? walkOrSocialEvent.briefDescriptionAndStartPoint : walkOrSocialEvent.briefDescription;
    const description = walkOrSocialEvent.longerDescription;
    const startDateTime: string = this.isWalk(walkOrSocialEvent)
      ? this.dateUtils.asMoment(this.startTime(walkOrSocialEvent)).toISOString()
      : this.dateUtils.asMoment(walkOrSocialEvent.eventDate).toISOString();
    const milesPerHour: number = this.isWalk(walkOrSocialEvent) ? walkOrSocialEvent.milesPerHour || this.walksConfig.milesPerHour : null;
    const groupEvent: GroupEvent = ramblersWalk ? {...ramblersWalk.groupEvent, title, description} : {
      area_code: "",
      ascent_feet: ascent?.feet.value,
      ascent_metres: ascent?.metres.value,
      cancellation_reason: "",
      date_created: "",
      date_updated: "",
      difficulty: this.isWalk(walkOrSocialEvent) ? this.walkDisplayService.toDifficulty(walkOrSocialEvent.grade) : null,
      distance_km: units?.kilometres?.value || 0,
      distance_miles: units?.miles?.value || 0,
      duration: null,
      end_date_time: this.isWalk(walkOrSocialEvent) ? this.finishTime(startDateTime, walkOrSocialEvent, milesPerHour) : walkOrSocialEvent.eventTimeEnd,
      end_location: this.isWalk(walkOrSocialEvent) ? walkOrSocialEvent.end_location : null,
      linked_event: "",
      meeting_date_time: "",
      meeting_location: undefined,
      shape: this.isWalk(walkOrSocialEvent) ? walkOrSocialEvent.walkType || WalkType.CIRCULAR : null,
      status: undefined,
      url: this.stringUtilsService.kebabCase(title, this.dateUtils.asMoment(startDateTime).format("YYYY-MM-DD")),
      id: null,
      title,
      description,
      start_date_time: startDateTime,
      start_location: this.isWalk(walkOrSocialEvent) ? walkOrSocialEvent.start_location : null,
      location: this.isWalk(walkOrSocialEvent) ? null : this.toLocation(walkOrSocialEvent),
      media: walkOrSocialEvent.media || [],
      group_code: this.isWalk(walkOrSocialEvent) ? walkOrSocialEvent.group?.groupCode || this.walkDisplayService.group.groupCode : this.walkDisplayService.group.groupCode,
      group_name: this.isWalk(walkOrSocialEvent) ? walkOrSocialEvent.group?.longName || this.walkDisplayService.group.longName : this.walkDisplayService.group.longName,
      external_url: this.isWalk(walkOrSocialEvent) ? walkOrSocialEvent.ramblersWalkUrl : walkOrSocialEvent.link,
      item_type: this.isWalk(walkOrSocialEvent) ? walkOrSocialEvent.eventType || RamblersEventType.GROUP_WALK : RamblersEventType.GROUP_EVENT,
      facilities: this.isWalk(walkOrSocialEvent) ? walkOrSocialEvent.features : [],
      transport: [],
      accessibility: [],
      additional_details: this.isWalk(walkOrSocialEvent) ? walkOrSocialEvent.additionalDetails : null,
      walk_leader: this.isWalk(walkOrSocialEvent)
        ? {
          is_overridden: true,
          has_email: !!walkOrSocialEvent.contactEmail,
          id: walkOrSocialEvent.contactId,
          name: walkOrSocialEvent.contactName,
          email_form: null,
          telephone: walkOrSocialEvent.contactPhone,
        }
        : null,
      event_organiser: !this.isWalk(walkOrSocialEvent)
        ? {
          is_overridden: true,
          has_email: !!walkOrSocialEvent.contactEmail,
          id: walkOrSocialEvent.eventContactMemberId,
          name: walkOrSocialEvent.displayName,
          email_form: null,
          telephone: walkOrSocialEvent.contactPhone,
        }
        : null,
    };

    const extendedFields: ExtendedFields = {
      attendees: [],
      milesPerHour,
      contactDetails: {
        memberId: this.isWalk(walkOrSocialEvent) ? walkOrSocialEvent.walkLeaderMemberId || null : walkOrSocialEvent.eventContactMemberId || null,
        displayName: walkOrSocialEvent.displayName || null,
        email: walkOrSocialEvent.contactEmail || null,
        phone: walkOrSocialEvent.contactPhone || null,
        contactId: this.isWalk(walkOrSocialEvent) ? walkOrSocialEvent.contactId || null : walkOrSocialEvent.eventContactMemberId || null,
      },
      publishing: {
        ramblers: {
          publish: this.isWalk(walkOrSocialEvent) ? walkOrSocialEvent.ramblersPublish : false,
          contactName: this.isWalk(walkOrSocialEvent) ? walkOrSocialEvent.contactId : null
        },
        meetup: {
          publish: this.isWalk(walkOrSocialEvent) ? walkOrSocialEvent.meetupPublish : false,
          contactName: null
        }
      },
      links: this.toLinks(walkOrSocialEvent),
      meetup: this.isWalk(walkOrSocialEvent) ? walkOrSocialEvent.config?.meetup : null,
      venue: this.isWalk(walkOrSocialEvent) ? walkOrSocialEvent.venue : null,
      riskAssessment: this.isWalk(walkOrSocialEvent) ? walkOrSocialEvent.riskAssessment : [],
      imageConfig: this.isWalk(walkOrSocialEvent) ? walkOrSocialEvent.imageConfig : null,
      notifications: this.isWalk(walkOrSocialEvent)
        ? []
        : [walkOrSocialEvent.notification]
    };

    return {
      groupEvent,
      fields: extendedFields,
      events: this.isWalk(walkOrSocialEvent) ? walkOrSocialEvent.events : [],
    };
  }

  private finishTime(startDateTime: string, walkOrSocialEvent: Walk, milesPerHour: number): string {
    return this.dateUtils.asMoment(this.dateUtils.asValue(startDateTime) + this.dateUtils.durationInMsecsForDistanceInMiles(walkOrSocialEvent.distance, milesPerHour)).toISOString();
  }

  private toLocation(socialEvent: SocialEvent): LocationDetails {
    return {
      grid_reference_6: null,
      grid_reference_8: null,
      latitude: null, longitude: null,
      w3w: null,
      postcode: socialEvent.postcode,
      description: socialEvent.longerDescription,
      grid_reference_10: null
    };
  }

  walkLink(walkOrSocialEvent: Walk | SocialEvent): string {
    return this.isWalk(walkOrSocialEvent) ? this.urlService.linkUrl({
      area: "walks",
      id: walkOrSocialEvent?.id || walkOrSocialEvent.ramblersWalkId
    }) : this.urlService.linkUrl({area: "social", id: walkOrSocialEvent?.id});
  }

  private toLinks(walkOrSocialEvent: Walk | SocialEvent): LinkWithSource[] {
    const common = {
      title: `this${this.isWalk(walkOrSocialEvent)}` ? "walk" : "social event",
      href: this.walkLink(walkOrSocialEvent),
      source: LinkSource.LOCAL
    };
    if (this.isWalk(walkOrSocialEvent)) {
      return [
        common,
        {
          title: null,
          href: walkOrSocialEvent.ramblersWalkUrl,
          source: LinkSource.RAMBLERS
        },
        {
          title: walkOrSocialEvent.meetupEventTitle,
          href: walkOrSocialEvent.meetupEventUrl,
          source: LinkSource.MEETUP
        },
        {
          title: walkOrSocialEvent.osMapsTitle,
          href: walkOrSocialEvent.osMapsRoute,
          source: LinkSource.OS_MAPS
        }].filter(item => item.href);
    } else {
      return [
        common,
        {
          title: walkOrSocialEvent.linkTitle,
          href: walkOrSocialEvent.link,
          source: LinkSource.VENUE
        }].filter(item => item.href);
    }
  }

  startTime(walk: Walk): number {
    if (walk) {
      const startTime: Time = this.dateUtils.parseTime(walk?.startTime);
      const walkDateMoment: moment = this.dateUtils.asMoment(walk?.walkDate);
      const walkDateAndTimeValue = this.dateUtils.calculateWalkDateAndTimeValue(walkDateMoment, startTime);
      this.logger.debug("text based startTime:", walk?.startTime,
        "startTime:", startTime,
        "walkDateMoment:", walkDateMoment.format(),
        "displayDateAndTime(walkDateMoment):", this.dateUtils.displayDateAndTime(walkDateMoment),
        "walkDateAndTime:", walkDateAndTimeValue,
        "displayDateAndTime(walkDateAndTimeValue):", this.dateUtils.displayDateAndTime(walkDateAndTimeValue));
      return walkDateAndTimeValue;
    } else {
      return null;
    }
  }

  async migrateEvents(saveData: boolean): Promise<ExtendedGroupEvent[]> {
    this.logger.info("Starting Migration of events");
    const ramblersWalks: ExtendedGroupEvent[] = await this.ramblersWalksAndEventsService.all({
      dataQueryOptions: this.walksQueryService.dataQueryOptions({
        ascending: false,
        selectType: DateCriteria.ALL_DATES
      })
    });
    this.logger.info("Found Ramblers Walks and Events:", ramblersWalks);
    const walks: Walk[] = await this.walksLocalLegacyService.all();
    const walksByDate: Walk[] = Object.entries(groupBy(walks, walk => walk.walkDate))
      .map((entry: [path: string, duplicates: Walk[]]) => (last(entry[1].sort(sortBy("walkDate")))));
    this.logger.info("walks:", walks, "walksByDate:", walksByDate);
    const migratedWalks = walksByDate.map(walk => ({input: walk, migrated: this.toExtendedGroupEvent(walk, ramblersWalks)}));
    this.logger.info("Migrated events :", migratedWalks.length);
    const extendedGroupEvents: ExtendedGroupEvent[] = migratedWalks.map(item => item.migrated);
    if (saveData) {
      const existing = await this.walksAndEventsLocalService.all();
      this.logger.info("Deleting existing", existing.length, "events");
      const deleted = await this.walksAndEventsLocalService.deleteAll(existing);
      this.logger.info("Deleted", deleted.length, "events");
      const created = await this.walksAndEventsLocalService.createOrUpdateAll(extendedGroupEvents);
      this.logger.info("Saved events :", created);
    } else {
      this.logger.info("Not saving extendedGroupEvents:", extendedGroupEvents);
    }
    return extendedGroupEvents;
  }
}
