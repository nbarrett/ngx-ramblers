import { inject, Injectable } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { PageContent, PageContentColumn } from "../models/content-text.model";
import { AccessLevel } from "../models/member-resource.model";
import { LocationDetails } from "../models/ramblers-walks-manager";
import { LoggerFactory } from "./logger-factory.service";
import { PageContentActionsService } from "./page-content-actions.service";
import { UrlService } from "./url.service";
import { StringUtilsService } from "./string-utils.service";
import { YouTubeService } from "./youtube.service";
import { last } from "es-toolkit/compat";

@Injectable({
  providedIn: "root"
})
export class LocationExtractionService {
  private logger = inject(LoggerFactory).createLogger("LocationExtractionService", NgxLoggerLevel.ERROR);
  private actions = inject(PageContentActionsService);
  private urlService = inject(UrlService);
  private stringUtils = inject(StringUtilsService);
  private youtubeService = inject(YouTubeService);

  extractLocationsFromPages(pages: PageContent[]): PageContentColumn[] {
    const columns: PageContentColumn[] = [];

    this.logger.info("extractLocationsFromPages: processing", pages.length, "pages");
    pages.forEach(pageContent => {
      const href = pageContent.path;
      const imageSource = this.findFirstImageInPage(pageContent);

      const locationRows = pageContent.rows.filter(row => this.actions.isLocation(row));
      this.logger.info("Page", pageContent.path, "has", locationRows.length, "location rows out of", pageContent.rows.length, "total rows");

      let location = null;
      let description = null;
      let title = null;

      if (locationRows.length > 0) {
        const firstLocationRow = locationRows[0];
        if (firstLocationRow.location?.start && this.hasValidLocation(firstLocationRow.location.start)) {
          location = firstLocationRow.location.start;
          description = this.formatLocationDescription(firstLocationRow.location.start, firstLocationRow.location.end);
        }
      }

      if (!description) {
        const extracted = this.extractTitleAndDescription(pageContent);
        title = extracted.title;
        description = extracted.description;
      }

      if (!title) {
        title = this.stringUtils.asTitle(last(this.urlService.pathSegmentsForUrl(href)));
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

  private extractTitleAndDescription(pageContent: PageContent): { title: string | null; description: string | null } {
    let result = { title: null, description: null };

    for (const row of pageContent.rows || []) {
      for (const column of row.columns || []) {
        if (column.contentText) {
          const text = column.contentText.trim();
          const headingMatch = text.match(/^#\s+(.+?)(?:\n|$)/);

          if (headingMatch) {
            const title = headingMatch[1].trim();
            const remainingText = text.substring(headingMatch[0].length).trim();
            const description = this.stringUtils.stripMarkdown(remainingText);
            const truncatedDescription = description.length > 200 ? description.substring(0, 197) + "..." : description;

            result = {
              title,
              description: truncatedDescription || null
            };
            break;
          } else {
            const strippedText = this.stringUtils.stripMarkdown(text);
            if (strippedText.length > 0) {
              const truncated = strippedText.length > 200 ? strippedText.substring(0, 197) + "..." : strippedText;
              result = { title: null, description: truncated };
              break;
            }
          }
        }
      }
      if (result.description !== null) {
        break;
      }
    }

    return result;
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
    let result: string | undefined = undefined;

    for (const row of pageContent.rows || []) {
      for (const column of row.columns || []) {
        if (column.imageSource) {
          result = column.imageSource;
          break;
        } else if (column.youtubeId) {
          result = this.youtubeService.thumbnailUrl(column.youtubeId);
          break;
        } else if (column.rows) {
          const nestedImage = this.findFirstImageInPage({rows: column.rows} as PageContent);
          if (nestedImage) {
            result = nestedImage;
            break;
          }
        }
      }
      if (result) {
        break;
      }
    }

    return result;
  }

  private hasValidLocation(location: LocationDetails): boolean {
    return !!(location.latitude && location.longitude) ||
           !!(location.postcode) ||
           !!(location.grid_reference_10);
  }
}
