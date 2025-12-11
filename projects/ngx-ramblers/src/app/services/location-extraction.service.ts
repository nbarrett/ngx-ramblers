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

    this.logger.info("extractLocationsFromPages: processing", pages.length, "pages");
    pages.forEach(pageContent => {
      const href = pageContent.path;
      const title = this.stringUtils.asTitle(last(this.urlService.pathSegmentsForUrl(href)));
      const imageSource = this.findFirstImageInPage(pageContent);

      const locationRows = pageContent.rows.filter(row => this.actions.isLocation(row));
      this.logger.info("Page", pageContent.path, "has", locationRows.length, "location rows out of", pageContent.rows.length, "total rows");

      let location = null;
      let description = null;

      if (locationRows.length > 0) {
        const firstLocationRow = locationRows[0];
        if (firstLocationRow.location?.start && this.hasValidLocation(firstLocationRow.location.start)) {
          location = firstLocationRow.location.start;
          description = this.formatLocationDescription(firstLocationRow.location.start, firstLocationRow.location.end);
        }
      }

      if (!description) {
        description = this.extractFirstParagraph(pageContent);
      }

      this.logger.info("Page:", title, "- location:", location ? "found" : "missing", "- imageSource:", imageSource);

      columns.push({
        title,
        contentText: description || "No description available",
        href,
        accessLevel: AccessLevel.public,
        imageSource,
        location
      });
    });

    this.logger.info("Extracted", columns.length, "page entries from", pages.length, "pages,",
                     columns.filter(c => c.location).length, "with locations");
    return columns;
  }

  private extractFirstParagraph(pageContent: PageContent): string | null {
    for (const row of pageContent.rows || []) {
      for (const column of row.columns || []) {
        if (column.contentText) {
          const text = column.contentText.trim();
          if (text.length > 0) {
            return text.length > 200 ? text.substring(0, 197) + "..." : text;
          }
        }
      }
    }
    return null;
  }

  private formatLocationDescription(start: LocationDetails, end?: LocationDetails): string {
    const startParts = this.parseLocationDescription(start.description);
    const endParts = end && this.hasValidLocation(end) ? this.parseLocationDescription(end.description) : null;

    if (endParts && startParts.place !== endParts.place) {
      const regionParts = [startParts.county, startParts.region].filter(Boolean);
      return `${startParts.place} to ${endParts.place}, ${regionParts.join(", ")}`;
    }

    return start.description || "Location";
  }

  private parseLocationDescription(description: string | undefined): { place: string; county?: string; region?: string } {
    if (!description) {
      return { place: "Unknown" };
    }

    const parts = description.split(",").map(p => p.trim());
    return {
      place: parts[0] || "Unknown",
      county: parts[1],
      region: parts[2]
    };
  }

  private findFirstImageInPage(pageContent: PageContent): string | undefined {
    for (const row of pageContent.rows || []) {
      for (const column of row.columns || []) {
        if (column.imageSource) {
          return column.imageSource;
        }
        if (column.rows) {
          const nestedImage = this.findFirstImageInPage({rows: column.rows} as PageContent);
          if (nestedImage) {
            return nestedImage;
          }
        }
      }
    }
    return undefined;
  }

  private hasValidLocation(location: LocationDetails): boolean {
    return !!(location.latitude && location.longitude) ||
           !!(location.postcode) ||
           !!(location.grid_reference_10);
  }
}
