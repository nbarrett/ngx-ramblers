import { inject, Injectable } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { EventLinkConfig, LINK_CONFIG, Links, LinkSource, LinkWithSource } from "../models/walk.model";
import { Logger, LoggerFactory } from "./logger-factory.service";
import { ExtendedFields } from "../models/group-event.model";

@Injectable({
  providedIn: "root"
})
export class LinksService {

  private logger: Logger = inject(LoggerFactory).createLogger("LinksService", NgxLoggerLevel.ERROR);

  public deleteLink(extendedFields: ExtendedFields, linkSource: LinkSource) {
    extendedFields.links = extendedFields.links.filter(item => item.source !== linkSource);
  }

  public linkExists(extendedFields: ExtendedFields, linkSource: LinkSource): boolean {
    return !!this.linkWithSourceFrom(extendedFields, linkSource);
  }

  public linkWithSourceFrom(extendedFields: ExtendedFields, linkSource: LinkSource): LinkWithSource {
    return extendedFields?.links?.find(item => item.source === linkSource);
  }

  public createOrUpdateLink(extendedFields: ExtendedFields, linkWithSource: LinkWithSource) {
    const existing = extendedFields.links.findIndex(item => item.source === linkWithSource.source);
    if (existing >= 0) {
      extendedFields.links[existing] = linkWithSource;
    } else {
      extendedFields.links.push(linkWithSource);
    }
  }

  linksFrom(links: LinkWithSource[]): Links {
    const returnValue: Links = {meetup: null, osMapsRoute: null, venue: null};
    LINK_CONFIG.forEach((linkConfig: EventLinkConfig) => {
      const linkWithSource: LinkWithSource = links?.find(item => item.source === linkConfig.code);
      this.assignLinkSourceUrl(returnValue, linkWithSource);
    });
    return returnValue;
  }

  private assignLinkSourceUrl(returnValue: Links, linkWithSource: LinkWithSource): void {
    switch (linkWithSource?.source) {
      case LinkSource.VENUE:
        returnValue.venue = linkWithSource;
        break;
      case LinkSource.MEETUP:
        returnValue.meetup = linkWithSource;
        break;
      case LinkSource.OS_MAPS:
        returnValue.osMapsRoute = linkWithSource;
        break;
    }
  }
}
