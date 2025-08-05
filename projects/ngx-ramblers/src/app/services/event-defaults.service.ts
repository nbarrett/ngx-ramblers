import { inject, Injectable } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { Logger, LoggerFactory } from "./logger-factory.service";
import { ContactDetails, ExtendedGroupEvent, InputSource } from "../models/group-event.model";
import { Contact, LocationDetails, RamblersEventType, WalkStatus } from "../models/ramblers-walks-manager";
import { SystemConfig } from "../models/system.model";
import { ImageConfig, ImageSource, MODERATE, WalkType } from "../models/walk.model";
import { DateUtilsService } from "./date-utils.service";
import { SystemConfigService } from "./system/system-config.service";
import { WalkEvent } from "../models/walk-event.model";
import { WalksConfigService } from "./system/walks-config.service";
import { WalksConfig } from "../models/walk-notification.model";
import { Member } from "../models/member.model";
import { DEFAULT_BASIC_EVENT_SELECTION } from "../models/search.model";
import { Observable, ReplaySubject } from "rxjs";
import { shareReplay } from "rxjs/operators";
import { StringUtilsService } from "./string-utils.service";

@Injectable({
  providedIn: "root"
})
export class EventDefaultsService {

  private ready = new ReplaySubject<boolean>();
  private logger: Logger = inject(LoggerFactory).createLogger("EventDefaultsService", NgxLoggerLevel.ERROR);
  private dateUtils = inject(DateUtilsService);
  private stringUtilsService: StringUtilsService = inject(StringUtilsService);
  private systemConfigService = inject(SystemConfigService);
  private systemConfig: SystemConfig;
  private walksConfigService = inject(WalksConfigService);
  private walksConfig: WalksConfig;
  constructor() {
    this.systemConfigService.events().subscribe(async systemConfig => {
      this.systemConfig = systemConfig;
      this.logger.info("System config:", this.systemConfig);
      this.broadcastIfReady();
    });
    this.walksConfigService.events().subscribe(walksConfig => {
      this.walksConfig = walksConfig;
      this.logger.info("walksConfig config:", this.walksConfig);
      this.broadcastIfReady();
    });
  }

  public events(): Observable<boolean> {
    return this.ready.pipe(shareReplay());
  }

  defaultImageConfig(source: ImageSource): ImageConfig {
    return {
      source,
      importFrom: {
        areaCode: this.systemConfig.area.groupCode,
        groupCode: this.systemConfig.group.groupCode,
        filterParameters: DEFAULT_BASIC_EVENT_SELECTION(),
      }
    };
  };

  defaultContactDetails(): ContactDetails {
    return {
      contactId: null,
      memberId: null,
      displayName: null,
      email: null,
      phone: null
    };
  };

  memberToContact(member: Member): Contact {
    return {
      is_overridden: false,
      id: member.id,
      name: member.displayName,
      telephone: member.mobileNumber || member.landlineTelephone || null,
      has_email: !!member.email
    };
  }

  nameToContact(name: string): Contact {
    return {
      is_overridden: false,
      id: null,
      name,
      telephone: null,
      has_email: false
    };
  }

  contactDetailsFrom(member: Member): ContactDetails {
    return {
      contactId: member.contactId,
      memberId: member.id,
      displayName: member.displayName,
      email: member.email,
      phone: member.mobileNumber
    };
  };

  public createDefault(defaults?: {
    title?: string;
    id?: string,
    inputSource: InputSource;
    start_date_time?: string,
    item_type?: RamblersEventType,
    shape?: WalkType,
    events?: WalkEvent[];
  }) {
    const now = this.dateUtils.momentNow().format();
    const itemType: RamblersEventType = defaults?.item_type || RamblersEventType.GROUP_WALK;
    const startDateTime = defaults?.start_date_time || now;
    const walk: ExtendedGroupEvent = {
      groupEvent: {
        id: defaults.id || null,
        item_type: itemType,
        title: defaults.title,
        group_code: this.systemConfig.group.groupCode,
        group_name: this.systemConfig.group.longName,
        area_code: this.systemConfig.area.groupCode,
        description: null,
        additional_details: null,
        start_date_time: startDateTime,
        end_date_time: null,
        meeting_date_time: null,
        location: itemType === RamblersEventType.GROUP_EVENT ? this.defaultLocation() : null,
        start_location: itemType === RamblersEventType.GROUP_EVENT ? null : this.defaultLocation(),
        meeting_location: null,
        end_location: null,
        distance_km: 0,
        distance_miles: 0,
        ascent_feet: 0,
        ascent_metres: 0,
        difficulty: MODERATE,
        shape: defaults?.shape || WalkType.CIRCULAR,
        duration: 0,
        walk_leader: null,
        url: this.initialUrl(defaults.title, startDateTime),
        external_url: null,
        status: WalkStatus.DRAFT,
        cancellation_reason: null,
        accessibility: [],
        facilities: [],
        transport: [],
        media: [],
        linked_event: null,
        date_created: now,
        date_updated: null
      },
      fields: {
        inputSource: defaults.inputSource,
        migratedFromId: null,
        contactDetails: this.defaultContactDetails(),
        publishing: {
          meetup: {publish: false, contactName: null},
          ramblers: {publish: true, contactName: null}
        },
        links: [],
        meetup: null,
        riskAssessment: [],
        notifications: [],
        milesPerHour: this.walksConfig.milesPerHour,
        attendees: []
      },
      events: defaults?.events || [],
    };
    return walk;
  }


  public initialUrl(title: string, startDateTime: string) {
    return this.stringUtilsService.kebabCase(title, this.dateUtils.yearMonthDayWithDashes(startDateTime));
  }

  private defaultLocation(): LocationDetails {
    return {
      latitude: 0,
      longitude: 0,
      grid_reference_6: null,
      grid_reference_8: null,
      grid_reference_10: null,
      postcode: null,
      description: null,
      w3w: null
    };
  }

  private broadcastIfReady() {
    if (this.walksConfig && this.systemConfig) {
      this.logger.info("Broadcasting ready event");
      this.ready.next(true);
    }
  }
}
