import { inject, Injectable } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { PageContent, PageContentColumn } from "../models/content-text.model";
import { AccessLevel } from "../models/member-resource.model";
import { LocationDetails } from "../models/ramblers-walks-manager";
import { LoggerFactory } from "./logger-factory.service";
import { PageContentActionsService } from "./page-content-actions.service";
import { UrlService } from "./url.service";
import { StringUtilsService } from "./string-utils.service";
import { last } from "es-toolkit/compat";

@Injectable({
  providedIn: "root"
})
export class LocationExtractionService {
  private logger = inject(LoggerFactory).createLogger("LocationExtractionService", NgxLoggerLevel.ERROR);
  private actions = inject(PageContentActionsService);
  private urlService = inject(UrlService);
  private stringUtils = inject(StringUtilsService);

  extractLocationsFromPages(pages: PageContent[]): PageContentColumn[] {
    const columns: PageContentColumn[] = [];

    pages.forEach(pageContent => {
      const locationRows = pageContent.rows.filter(row => this.actions.isLocation(row));

      locationRows.forEach(row => {
        if (row.location?.start && this.hasValidLocation(row.location.start)) {
          const href = pageContent.path;
          const title = this.stringUtils.asTitle(last(this.urlService.pathSegmentsForUrl(href)));
          const description = row.location.start.description || "Location";

          columns.push({
            title: title,
            contentText: description,
            href: href,
            accessLevel: AccessLevel.public,
            imageSource: null
          });
        }
      });
    });

    this.logger.info("Extracted", columns.length, "locations from", pages.length, "pages");
    return columns;
  }

  private hasValidLocation(location: LocationDetails): boolean {
    return !!(location.latitude && location.longitude) ||
           !!(location.postcode) ||
           !!(location.grid_reference_10);
  }
}
