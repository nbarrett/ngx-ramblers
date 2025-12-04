import { inject, Injectable } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { Logger, LoggerFactory } from "../logger-factory.service";
import { bestLocation, extractLocations } from "server/lib/shared/location-extractor";
import { ExtractedLocation } from "../../models/map.model";

@Injectable({
  providedIn: "root"
})
export class MigrationLocationExtractionService {
  private logger: Logger = inject(LoggerFactory).createLogger("MigrationLocationExtractionService", NgxLoggerLevel.INFO);

  extractLocations(text: string): ExtractedLocation[] {
    const locations = extractLocations(text);
    this.logger.info("Extracted locations from extracted locations", locations);
    return locations;
  }

  bestLocation(locations: ExtractedLocation[]): ExtractedLocation | null {
    const extractedLocation = bestLocation(locations);
    this.logger.info("Extracted extractedLocation from locations:", locations, "extractedLocation:", extractedLocation);
    return extractedLocation;
  }
}
