import { inject, Injectable } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { Logger, LoggerFactory } from "./logger-factory.service";
import { ContactDetails, ExtendedGroupEvent } from "../models/group-event.model";
import { RamblersEventType, WalkStatus } from "../models/ramblers-walks-manager";
import { SystemConfig } from "../models/system.model";
import { ImageConfig, ImageSource, MODERATE, WalkType } from "../models/walk.model";
import { DateUtilsService } from "./date-utils.service";
import { SystemConfigService } from "./system/system-config.service";
import { WalkEvent } from "../models/walk-event.model";
import { WalksConfigService } from "./system/walks-config.service";
import { WalksConfig } from "../models/walk-notification.model";
import { Member } from "../models/member.model";
import { DEFAULT_BASIC_EVENT_SELECTION } from "../models/search.model";

@Injectable({
  providedIn: "root"
})
export class EventDefaultsService {

  private logger: Logger = inject(LoggerFactory).createLogger("EventDefaultsService", NgxLoggerLevel.ERROR);
  private dateUtils = inject(DateUtilsService);
  private systemConfigService = inject(SystemConfigService);
  private systemConfig: SystemConfig;
  private walksConfigService = inject(WalksConfigService);
  private walksConfig: WalksConfig;
  constructor() {
    this.systemConfigService.events().subscribe(async item => {
      this.systemConfig = item;
    });
      this.walksConfigService.events().subscribe(walksConfig => this.walksConfig = walksConfig);
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
    id?: string,
    start_date_time?: string,
    item_type?: RamblersEventType,
    shape?: WalkType,
    events?: WalkEvent[];
  }) {
    const now = this.dateUtils.momentNow().format();
    const walk: ExtendedGroupEvent = {
      groupEvent: {
        id: defaults.id || null,
        item_type: defaults?.item_type || RamblersEventType.GROUP_WALK,
        title: null,
        group_code: null,
        area_code: this.systemConfig.area.groupCode,
        group_name: this.systemConfig.group.shortName,
        description: null,
        additional_details: null,
        start_date_time: defaults?.start_date_time || now,
        end_date_time: null,
        meeting_date_time: null,
        start_location: null,
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
        url: null,
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


}
