import { inject, Injectable } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { Observable } from "rxjs";
import { DataQueryOptions } from "../../models/api-request.model";
import { Logger, LoggerFactory } from "../logger-factory.service";
import { EventPopulation, Organisation } from "../../models/system.model";
import { SystemConfigService } from "../system/system-config.service";
import { SocialEventsLocalService } from "./social-events-local.service";
import { RamblersWalksAndEventsService } from "../walks/ramblers-walks-and-events.service";
import { ExtendedGroupEvent, ExtendedGroupEventApiResponse } from "../../models/group-event.model";

@Injectable({
  providedIn: "root"
})
export class SocialEventsService {

  private logger: Logger = inject(LoggerFactory).createLogger("SocialEventsService", NgxLoggerLevel.ERROR);
  private systemConfigService = inject(SystemConfigService);
  private socialEventsLocalService = inject(SocialEventsLocalService);
  private ramblersWalksAndEventsService = inject(RamblersWalksAndEventsService);
  public group: Organisation;

  constructor() {
    this.applyConfig();
  }

  private applyConfig() {
    this.logger.info("applyConfig called");
    this.systemConfigService.events().subscribe(item => {
      this.group = item.group;
      this.logger.info("group:", this.group);
    });
  }


  notifications(): Observable<ExtendedGroupEventApiResponse> {
    return this.socialEventsLocalService.notifications();
  }

  async all(dataQueryOptions?: DataQueryOptions): Promise<ExtendedGroupEvent[]> {
    this.logger.info("all called with socialEventPopulation:", this.group?.socialEventPopulation);
    switch (this.group?.socialEventPopulation) {
      case EventPopulation.WALKS_MANAGER:
        return this.ramblersWalksAndEventsService.allSocialEvents(dataQueryOptions);
      case EventPopulation.LOCAL:
        return this.socialEventsLocalService.all(dataQueryOptions);
    }
  }

  async allPublic(dataQueryOptions?: DataQueryOptions): Promise<ExtendedGroupEvent[]> {
    switch (this.group?.socialEventPopulation) {
      case EventPopulation.WALKS_MANAGER:
        return this.ramblersWalksAndEventsService.allSocialEvents(dataQueryOptions);
      case EventPopulation.LOCAL:
        return this.socialEventsLocalService.allPublic(dataQueryOptions);
    }
  }

  async createOrUpdate(socialEvent: ExtendedGroupEvent): Promise<ExtendedGroupEvent> {
    if (socialEvent.id) {
      return this.update(socialEvent);
    } else {
      return this.create(socialEvent);
    }
  }

  async queryForId(socialEventId: string): Promise<ExtendedGroupEvent> {
    this.logger.info("getById called with socialEventId:", socialEventId, "with socialEventPopulation:", this.group?.socialEventPopulation);
    switch (this.group?.socialEventPopulation) {
      case EventPopulation.WALKS_MANAGER:
        return this.ramblersWalksAndEventsService.socialEventForId(socialEventId);
      case EventPopulation.LOCAL:
        return this.socialEventsLocalService.queryForId(socialEventId);
    }
  }

  async update(socialEvent: ExtendedGroupEvent): Promise<ExtendedGroupEvent> {
    switch (this.group?.socialEventPopulation) {
      case EventPopulation.WALKS_MANAGER:
        return Promise.reject("cannot update social event as socialEventPopulation is " + this.group?.socialEventPopulation);
      case EventPopulation.LOCAL:
        return this.socialEventsLocalService.update(socialEvent);
    }
  }

  async create(socialEvent: ExtendedGroupEvent): Promise<ExtendedGroupEvent> {
    switch (this.group?.socialEventPopulation) {
      case EventPopulation.WALKS_MANAGER:
        return Promise.reject("cannot create social event as socialEventPopulation is " + this.group?.socialEventPopulation);
      case EventPopulation.LOCAL:
        return this.socialEventsLocalService.create(socialEvent);
    }
  }

  async delete(socialEvent: ExtendedGroupEvent): Promise<ExtendedGroupEvent> {
    switch (this.group?.socialEventPopulation) {
      case EventPopulation.WALKS_MANAGER:
        return Promise.reject("cannot delete social event as socialEventPopulation is " + this.group?.socialEventPopulation);
      case EventPopulation.LOCAL:
        return this.socialEventsLocalService.delete(socialEvent);
    }
  }
}
