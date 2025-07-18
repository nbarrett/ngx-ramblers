import { inject, Injectable } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { LocationDetails, Media, RamblersEventType } from "../../models/ramblers-walks-manager";
import { GroupEventField, ImageSource, LinkSource, LinkWithSource, WalkType } from "../../models/walk.model";
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
import { RamblersWalksAndEventsService } from "../walks-and-events/ramblers-walks-and-events.service";
import { FilterCriteria } from "../../models/api-request.model";
import { ExtendedGroupEventQueryService } from "../walks-and-events/extended-group-event-query.service";
import { LocalWalksAndEventsService } from "../walks-and-events/local-walks-and-events.service";
import { WalksConfigService } from "../system/walks-config.service";
import { WalksConfig } from "../../models/walk-notification.model";
import groupBy from "lodash-es/groupBy";
import { firstPopulated, sortBy } from "../../functions/arrays";
import last from "lodash-es/last";
import { NumberUtilsService } from "../number-utils.service";
import { SocialEventsLocalLegacyService } from "../social-events/social-events-local-legacy.service";
import { MediaQueryService } from "../committee/media-query.service";
import { EventDefaultsService } from "../event-defaults.service";

@Injectable({
  providedIn: "root"
})
export class EventsMigrationService {

  private logger: Logger = inject(LoggerFactory).createLogger("EventsMigrationService", NgxLoggerLevel.ERROR);
  private eventDefaultsService = inject(EventDefaultsService);
  private dateUtils: DateUtilsService = inject(DateUtilsService);
  private stringUtilsService: StringUtilsService = inject(StringUtilsService);
  private walksLocalLegacyService: WalksLocalLegacyService = inject(WalksLocalLegacyService);
  private socialEventsLocalLegacyService = inject(SocialEventsLocalLegacyService);
  private legacyDistanceValidationService: LegacyDistanceValidationService = inject(LegacyDistanceValidationService);
  private legacyAscentValidationService: LegacyAscentValidationService = inject(LegacyAscentValidationService);
  private walkDisplayService: WalkDisplayService = inject(WalkDisplayService);
  private extendedGroupEventQueryService: ExtendedGroupEventQueryService = inject(ExtendedGroupEventQueryService);
  private walksConfigService = inject(WalksConfigService);
  private ramblersWalksAndEventsService: RamblersWalksAndEventsService = inject(RamblersWalksAndEventsService);
  private localWalksAndEventsService: LocalWalksAndEventsService = inject(LocalWalksAndEventsService);
  private numberUtils = inject(NumberUtilsService);
  private urlService: UrlService = inject(UrlService);
  private mediaQueryService: MediaQueryService = inject(MediaQueryService);
  private walksConfig: WalksConfig;
  private dryRun = false;

  constructor() {
    this.walksConfigService.events().subscribe(walksConfig => this.walksConfig = walksConfig);
  }


  isWalk = (event: Walk | SocialEvent): event is Walk => event && "walkDate" in event;

  async migrateSocialEventUrls() {
    this.logger.info("migrateSocialEventUrls:starting migration of social event URLs");
    const socialEvents: ExtendedGroupEvent[] = await this.localWalksAndEventsService.all({
      types: [RamblersEventType.GROUP_EVENT],
      dataQueryOptions: {sort: {[GroupEventField.START_DATE]: -1}}
    });
    this.logger.info("migrateSocialEventUrls:found social events:", socialEvents);
    const usedUrls = new Set<string>();
    const changedEvents: ExtendedGroupEvent[] = [];

    for (const event of socialEvents) {
      const baseUrl = this.stringUtilsService.kebabCase(event.groupEvent.title);
      let url = baseUrl;
      let suffix = 2;
      while (usedUrls.has(url)) {
        url = `${baseUrl}-${suffix++}`;
      }
      usedUrls.add(url);
      if (event.groupEvent.url !== url) {
        this.logger.info("migrateSocialEventUrls:updated social event URL:", url, "for event:", event.groupEvent.title, event.groupEvent);
        event.groupEvent.url = url;
        changedEvents.push(event);
      }
    }
    if (this.dryRun) {
      this.logger.info("Dry run: not saving social events with updated URLs:", changedEvents, "usedUrls:", usedUrls);
    } else if (changedEvents.length > 0) {
      await this.localWalksAndEventsService.createOrUpdateAll(changedEvents);
      this.logger.info("Saved social events with updated URLs:", changedEvents, "usedUrls:", usedUrls);
    } else {
      this.logger.info("No social event URLs needed updating.");
    }
  }

  toExtendedGroupEvent(walkOrSocialEvent: Walk | SocialEvent, ramblersWalks: ExtendedGroupEvent[]): ExtendedGroupEvent {
    if (!walkOrSocialEvent) return;
    const ramblersWalk: ExtendedGroupEvent = this.isWalk(walkOrSocialEvent) ? ramblersWalks.find(item => item.groupEvent.id === walkOrSocialEvent.ramblersWalkId) : null;
    if (ramblersWalk) {
      this.logger.info("Found existing Ramblers Walk for walkOrSocialEvent.ramblersWalkId:", ramblersWalk.groupEvent.id, "ramblersWalk:", ramblersWalk, "start_date_time:", ramblersWalk.groupEvent.start_date_time);
    }
    const units = this.isWalk(walkOrSocialEvent) ? this.legacyDistanceValidationService.parse(walkOrSocialEvent) : null;
    const ascent = this.isWalk(walkOrSocialEvent) ? this.legacyAscentValidationService.parse(walkOrSocialEvent) : null;
    const title = this.isWalk(walkOrSocialEvent) ? walkOrSocialEvent.briefDescriptionAndStartPoint : walkOrSocialEvent.briefDescription;
    const description = walkOrSocialEvent.longerDescription;
    const startDateTime: string = this.isWalk(walkOrSocialEvent)
      ? this.startTime(walkOrSocialEvent)
      : this.dateUtils.startTimeFrom(walkOrSocialEvent.eventTimeStart, walkOrSocialEvent.eventDate);
    const milesPerHour: number = this.isWalk(walkOrSocialEvent) ? walkOrSocialEvent.milesPerHour || this.walksConfig.milesPerHour : null;
    const media: Media[] = this.isWalk(walkOrSocialEvent) ? walkOrSocialEvent.media : this.mediaFrom(walkOrSocialEvent);
    const groupEvent: GroupEvent = ramblersWalk ? {
      ...ramblersWalk.groupEvent,
      title,
      description,
      media: firstPopulated(media, ramblersWalk.groupEvent.media)
    } : {
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
      end_date_time: this.isWalk(walkOrSocialEvent) ? this.finishTime(startDateTime, walkOrSocialEvent, milesPerHour) : this.socialEventFinishTime(walkOrSocialEvent),
      end_location: this.isWalk(walkOrSocialEvent) ? walkOrSocialEvent.end_location : null,
      linked_event: "",
      meeting_date_time: "",
      meeting_location: undefined,
      shape: this.isWalk(walkOrSocialEvent) ? walkOrSocialEvent.walkType || WalkType.CIRCULAR : null,
      status: undefined,
      url: this.stringUtilsService.kebabCase(title, this.dateUtils.asMoment(startDateTime).format("YYYY-MM-DD")),
      id: ramblersWalk?.groupEvent?.id || null,
      title,
      description,
      start_date_time: startDateTime,
      start_location: this.isWalk(walkOrSocialEvent) ? walkOrSocialEvent.start_location : null,
      location: this.isWalk(walkOrSocialEvent) ? null : this.toLocation(walkOrSocialEvent),
      media,
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

    const links = this.linksFrom(walkOrSocialEvent);
    const extendedFields: ExtendedFields = {
      migratedFromId: walkOrSocialEvent.id,
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
      links,
      meetup: this.isWalk(walkOrSocialEvent) ? walkOrSocialEvent.config?.meetup : null,
      venue: this.isWalk(walkOrSocialEvent) ? walkOrSocialEvent.venue : null,
      riskAssessment: this.isWalk(walkOrSocialEvent) ? walkOrSocialEvent.riskAssessment : [],
      imageConfig: this.isWalk(walkOrSocialEvent) ? walkOrSocialEvent.imageConfig : this.eventDefaultsService.defaultImageConfig(walkOrSocialEvent.thumbnail ? ImageSource.LOCAL : ImageSource.NONE),
      notifications: this.isWalk(walkOrSocialEvent)
        ? []
        : [walkOrSocialEvent.notification]
    };
    this.logger.info("toExtendedGroupEvent: links:", links, "walkOrSocialEvent:", walkOrSocialEvent, "extendedFields:", extendedFields);
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
      latitude: null,
      longitude: null,
      w3w: null,
      postcode: socialEvent.postcode,
      description: socialEvent.location,
      grid_reference_10: null
    };
  }

  walkLink(walkOrSocialEvent: Walk | SocialEvent): string {
    return this.isWalk(walkOrSocialEvent) ?
      this.urlService.linkUrl({
        area: "walks", id: walkOrSocialEvent?.id || walkOrSocialEvent.ramblersWalkId
      }) :
      this.urlService.linkUrl({
        area: "social", id: walkOrSocialEvent?.id
      });
  }

  private linksFrom(walkOrSocialEvent: Walk | SocialEvent): LinkWithSource[] {
    const common = {
      title: `this ${this.isWalk(walkOrSocialEvent) ? "walk" : "social event"}`,
      href: this.walkLink(walkOrSocialEvent),
      source: LinkSource.LOCAL
    };
    if (this.isWalk(walkOrSocialEvent)) {
      return [
        common,
        {
          title: walkOrSocialEvent.briefDescriptionAndStartPoint,
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

  startTime(walk: Walk): string {
    if (walk) {
      return this.dateUtils.startTimeFrom(walk?.startTime, walk?.walkDate);
    } else {
      return null;
    }
  }

  socialEventFinishTime(socialEvent: SocialEvent): string {
    if (socialEvent?.eventTimeEnd) {
      const finishTime: Time = this.dateUtils.parseTime(socialEvent?.eventTimeEnd);
      const socialDateMoment: moment = this.dateUtils.asMoment(socialEvent?.eventDate);
      const socialEventEndTimeValue = this.dateUtils.calculateWalkDateAndTimeValue(socialDateMoment, finishTime);
      const socialEventEndTime = this.dateUtils.isoDateTime(socialEventEndTimeValue);
      this.logger.info("text based finishTime:", socialEvent?.eventTimeEnd,
        "finishTime:", finishTime,
        "walkDateAndTime:", socialEventEndTimeValue,
        "socialEventEndTime:", socialEventEndTime);
      return socialEventEndTime;
    } else {
      return null;
    }
  }

  public async migrateWalks(saveData: boolean): Promise<ExtendedGroupEvent[]> {
    this.logger.info("Starting Migration of walks");
    const ramblersWalks: ExtendedGroupEvent[] = await this.allRamblersWalks();
    this.logger.info("Found Ramblers Walks and Events:", ramblersWalks);
    const walks: Walk[] = await this.walksLocalLegacyService.all();
    const walksByDate: Walk[] = Object.entries(groupBy(walks, walk => walk.walkDate))
      .map((entry: [path: string, duplicates: Walk[]]) => (last(entry[1].sort(sortBy("walkDate")))));
    this.logger.info("walks:", walks, "walksByDate:", walksByDate);
    const migratedWalks = walksByDate.map(walk => ({
      input: walk,
      migrated: this.toExtendedGroupEvent(walk, ramblersWalks)
    }));
    this.logger.info("Migrated events :", migratedWalks.length);
    const extendedGroupEvents: ExtendedGroupEvent[] = migratedWalks.map(item => item.migrated);
    if (saveData) {
      const existing = await this.localWalksAndEventsService.all({types: [RamblersEventType.GROUP_WALK]});
      this.logger.info("Deleting existing", existing.length, "events");
      const deleted = await this.localWalksAndEventsService.deleteAll(existing);
      this.logger.info("Deleted", deleted.length, "events");
      const created = await this.localWalksAndEventsService.createOrUpdateAll(extendedGroupEvents);
      this.logger.info("Saved events :", created);
    } else {
      this.logger.info("Not saving extendedGroupEvents:", extendedGroupEvents);
    }
    return extendedGroupEvents;
  }

  private async allRamblersWalks() {
    return await this.ramblersWalksAndEventsService.all({
      dataQueryOptions: this.extendedGroupEventQueryService.dataQueryOptions({
        ascending: false,
        selectType: FilterCriteria.ALL_EVENTS
      })
    });
  }

  public async migrateSocialEvents(saveData: boolean): Promise<ExtendedGroupEvent[]> {
    this.logger.info("Starting Migration of social events");
    const socialEvents: SocialEvent[] = await this.socialEventsLocalLegacyService.all();
    const socialEventsByDate: SocialEvent[] = Object.entries(groupBy(socialEvents, walk => walk.eventDate))
      .map((entry: [path: string, duplicates: SocialEvent[]]) => (last(entry[1].sort(sortBy("eventDate")))));
    this.logger.info("socialEvents:", socialEvents, "socialEventsByDate:", socialEventsByDate);
    const migratedSocialEvents = socialEventsByDate.map(socialEvent => ({
      input: socialEvent,
      migrated: this.toExtendedGroupEvent(socialEvent, [])
    }));
    this.logger.info("Migrated events :", migratedSocialEvents.length);
    const extendedGroupEvents: ExtendedGroupEvent[] = migratedSocialEvents.map(item => item.migrated);
    if (saveData) {
      const existingSocials = await this.localWalksAndEventsService.all({types: [RamblersEventType.GROUP_EVENT]});
      this.logger.info("Deleting existing:", existingSocials.length, "social events");
      const deleted = await this.localWalksAndEventsService.deleteAll(existingSocials);
      this.logger.info("Deleted", deleted.length, "events");
      const created = await this.localWalksAndEventsService.createOrUpdateAll(extendedGroupEvents);
      this.logger.info("Saved events :", created);
    } else {
      this.logger.info("Not saving extendedGroupEvents:", extendedGroupEvents);
    }
    return extendedGroupEvents;
  }

  public mediaFrom(walkOrSocialEvent: SocialEvent) {
    return [this.mediaQueryService.mediaFrom(walkOrSocialEvent.briefDescription, walkOrSocialEvent.thumbnail)];
  }

  async migrateOneSocialEvent(socialEventId: string): Promise<ExtendedGroupEvent> {
    if (socialEventId) {
      const old: SocialEvent = await this.socialEventsLocalLegacyService.queryForId(socialEventId);
      const migrated = this.toExtendedGroupEvent(old, []);
      this.logger.info("migrated social event:", migrated, "from old social event:", old);
      return migrated;
    }
  }

  async migrateOneWalk(walkEventId: string) {
    if (walkEventId) {
      const ramblersWalks: ExtendedGroupEvent[] = await this.allRamblersWalks();
      const old: Walk = await this.walksLocalLegacyService.getByIdIfPossible(walkEventId);
      const migrated = this.toExtendedGroupEvent(old, ramblersWalks);
      this.logger.info("migrated walk:", migrated, "from old walk:", old);
    }
  }
}
