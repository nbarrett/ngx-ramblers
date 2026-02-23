import { inject, Injectable } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { EventLinkConfig, LINK_CONFIG, Links, LinkSource, LinkWithSource } from "../models/walk.model";
import { Logger, LoggerFactory } from "./logger-factory.service";
import { ExtendedFields, ExtendedGroupEvent } from "../models/group-event.model";
import { GoogleMapsService } from "./google-maps.service";
import { UrlService } from "./url.service";

@Injectable({
  providedIn: "root"
})
export class LinksService {

  private logger: Logger = inject(LoggerFactory).createLogger("LinksService", NgxLoggerLevel.ERROR);
  public googleMapsService = inject(GoogleMapsService);
  private urlService = inject(UrlService);
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

  linksFrom(extendedGroupEvent: ExtendedGroupEvent): Links {
    const links: Links = {meetup: null, osMapsRoute: null, venue: null};
    LINK_CONFIG.forEach((linkConfig: EventLinkConfig) => {
      const existingLinkWithSource: LinkWithSource = extendedGroupEvent?.fields?.links?.find(item => item.source === linkConfig.code);
      this.assignLinkSourceUrl(links, existingLinkWithSource, linkConfig.code, extendedGroupEvent);
    });
    return links;
  }

  private assignLinkSourceUrl(links: Links, existingLinkWithSource: LinkWithSource, code: LinkSource, extendedGroupEvent: ExtendedGroupEvent): void {
    this.logger.info("assignLinkSourceUrl: existingLinkWithSource:", existingLinkWithSource, "code:", code, "extendedGroupEvent:", extendedGroupEvent);
    switch (code) {
      case LinkSource.VENUE:
        const linkFromVenue: LinkWithSource = extendedGroupEvent?.fields?.venue?.url || extendedGroupEvent?.fields?.venue?.postcode ? {
          source: LinkSource.VENUE,
          href: extendedGroupEvent.fields.venue.url || this.googleMapsService.urlForPostcode(extendedGroupEvent.fields.venue.postcode),
          title: extendedGroupEvent.fields.venue.name
        } : null;
        links.venue = existingLinkWithSource || linkFromVenue;
        this.logger.info("assignLinkSourceUrl: links.venue:", links?.venue, "from extendedGroupEvent.fields.venue:", extendedGroupEvent?.fields?.venue);
        break;
      case LinkSource.MEETUP:
        if (existingLinkWithSource) {
          links.meetup = existingLinkWithSource;
        } else if (this.urlService.isMeetupUrl(extendedGroupEvent?.groupEvent?.external_url)) {
          links.meetup = {
            href: extendedGroupEvent.groupEvent.external_url,
            title: extendedGroupEvent.groupEvent.title
          };
        } else {
          links.meetup = null;
        }
        break;
      case LinkSource.OS_MAPS:
        links.osMapsRoute = existingLinkWithSource;
        break;
    }
  }
}
