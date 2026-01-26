import { HttpClient } from "@angular/common/http";
import { inject, Injectable } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { firstValueFrom } from "rxjs";
import { VenueParseResult } from "../../models/event-venue.model";
import { Logger, LoggerFactory } from "../logger-factory.service";

export interface VenueScrapeResponse {
  venue: {
    name?: string;
    address1?: string;
    address2?: string;
    postcode?: string;
    type?: string;
    url?: string;
    phone?: string;
  };
  confidence: number;
  warnings: string[];
}

@Injectable({
  providedIn: "root"
})
export class VenueScraperService {

  private logger: Logger = inject(LoggerFactory).createLogger("VenueScraperService", NgxLoggerLevel.ERROR);
  private http = inject(HttpClient);

  async scrapeVenueFromUrl(url: string): Promise<VenueParseResult> {
    this.logger.info("scrapeVenueFromUrl:", url);
    try {
      const response = await firstValueFrom(
        this.http.post<VenueScrapeResponse>("/api/migration/scrape-venue", { url })
      );
      this.logger.info("scrapeVenueFromUrl: response:", response);
      return {
        venue: {
          name: response.venue.name,
          address1: response.venue.address1,
          address2: response.venue.address2,
          postcode: response.venue.postcode,
          type: response.venue.type,
          url: response.venue.url
        },
        confidence: response.confidence,
        warnings: response.warnings
      };
    } catch (error: any) {
      this.logger.error("scrapeVenueFromUrl: error:", error);
      throw new Error(error?.error?.error || error?.message || "Failed to scrape venue from URL");
    }
  }

  isValidUrl(url: string): boolean {
    if (!url?.trim()) {
      return false;
    }
    try {
      const parsed = new URL(url.trim());
      return /^https?:$/i.test(parsed.protocol);
    } catch {
      return false;
    }
  }

  async searchForVenueWebsite(query: string): Promise<{ url: string } | null> {
    this.logger.info("searchForVenueWebsite:", query);
    try {
      const response = await firstValueFrom(
        this.http.post<{ url: string | null }>("/api/migration/search-venue-website", { query })
      );
      this.logger.info("searchForVenueWebsite: response:", response);
      return response?.url ? { url: response.url } : null;
    } catch (error: any) {
      this.logger.error("searchForVenueWebsite: error:", error);
      throw new Error(error?.error?.error || error?.message || "Failed to search for venue website");
    }
  }
}
