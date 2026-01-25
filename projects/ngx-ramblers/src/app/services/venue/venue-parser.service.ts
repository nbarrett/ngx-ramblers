import { Injectable, inject } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { inferVenueTypeFromName, Venue, VenueParseResult } from "../../models/event-venue.model";
import { Logger, LoggerFactory } from "../logger-factory.service";
import { isEmpty, isString } from "es-toolkit/compat";

@Injectable({
  providedIn: "root"
})
export class VenueParserService {

  private logger: Logger = inject(LoggerFactory).createLogger("VenueParserService", NgxLoggerLevel.ERROR);

  private readonly UK_POSTCODE_REGEX = /\b([A-Z]{1,2}\d{1,2}[A-Z]?\s*\d[A-Z]{2})\b/gi;
  private readonly URL_REGEX = /https?:\/\/[^\s<>"{}|\\^`\[\]]+/gi;
  private readonly PHONE_REGEX = /(?:0\d{2,4}[\s.-]?\d{3,4}[\s.-]?\d{3,4}|\+44[\s.-]?\d{2,4}[\s.-]?\d{3,4}[\s.-]?\d{3,4})/gi;

  parse(text: string): VenueParseResult {
    if (!isString(text) || isEmpty(text.trim())) {
      return this.emptyResult();
    }

    this.logger.info("parse: parsing text of length", text.length);

    const venue: Partial<Venue> = {};
    const warnings: string[] = [];
    let confidence = 0;

    const cleanedText = this.cleanText(text);
    const lines = this.splitIntoLines(cleanedText);

    const postcodes = this.extractPostcodes(text);
    if (postcodes.length > 0) {
      venue.postcode = this.normalizePostcode(postcodes[0]);
      confidence += 30;
      if (postcodes.length > 1) {
        warnings.push(`Multiple postcodes found, using: ${venue.postcode}`);
      }
    }

    const urls = this.extractUrls(text);
    if (urls.length > 0) {
      venue.url = urls[0];
      confidence += 20;
      if (urls.length > 1) {
        warnings.push(`Multiple URLs found, using first one`);
      }
    }

    const addressLines = this.extractAddressLines(lines, venue.postcode || null);
    if (addressLines.name) {
      venue.name = addressLines.name;
      confidence += 25;
    }
    if (addressLines.address1) {
      venue.address1 = addressLines.address1;
      confidence += 15;
    }
    if (addressLines.address2) {
      venue.address2 = addressLines.address2;
      confidence += 10;
    }

    venue.type = this.inferVenueType(text, venue.name || "");

    if (isEmpty(venue.name) && isEmpty(venue.postcode)) {
      warnings.push("Could not extract venue name or postcode");
      confidence = 0;
    }

    this.logger.info("parse: result", { venue, confidence, warnings });

    return { venue, confidence, warnings };
  }

  private emptyResult(): VenueParseResult {
    return {
      venue: {},
      confidence: 0,
      warnings: ["No text provided"]
    };
  }

  private cleanText(text: string): string {
    return text
      .replace(/\r\n/g, "\n")
      .replace(/\r/g, "\n")
      .replace(/\t/g, " ")
      .replace(/\s*\|\s*/g, ", ")
      .replace(/,\s*UK\b/gi, "")
      .replace(/,\s*United Kingdom\b/gi, "")
      .trim();
  }

  private splitIntoLines(text: string): string[] {
    return text
      .split("\n")
      .map(line => line.trim())
      .filter(line => line.length > 0);
  }

  private extractPostcodes(text: string): string[] {
    const matches = text.match(this.UK_POSTCODE_REGEX) || [];
    return matches.map(postcode => this.normalizePostcode(postcode));
  }

  private normalizePostcode(postcode: string): string {
    const clean = postcode.toUpperCase().replace(/\s+/g, "");
    if (clean.length >= 5) {
      return clean.slice(0, -3) + " " + clean.slice(-3);
    }
    return clean;
  }

  private extractUrls(text: string): string[] {
    const matches = text.match(this.URL_REGEX) || [];
    return matches.map(url => url.replace(/[.,;:!?]+$/, ""));
  }

  private extractAddressLines(lines: string[], postcode: string | null): { name: string | null; address1: string | null; address2: string | null } {
    const result = { name: null as string | null, address1: null as string | null, address2: null as string | null };

    const allParts: string[] = [];
    lines.forEach(line => {
      const lineWithoutUrls = line.replace(this.URL_REGEX, "").trim();
      const lineWithoutPhones = lineWithoutUrls.replace(this.PHONE_REGEX, "").trim();

      if (lineWithoutPhones.length < 3) {
        return;
      }

      const parts = lineWithoutPhones.split(",").map(part => this.cleanAddressLine(part));
      parts.forEach(part => {
        if (part.length >= 3) {
          allParts.push(part);
        }
      });
    });

    const filteredParts = allParts
      .map(part => this.removePostcodeFromPart(part, postcode))
      .filter(part => part.length >= 3);

    if (filteredParts.length === 0) {
      return result;
    }

    const streetIndicators = /\b(road|rd|street|st|lane|ln|avenue|ave|drive|dr|close|cl|way|place|pl|court|ct|crescent|cres|hill|green|park|terrace|grove|gardens|row|walk|mews|rise|view|fields|meadow|copse)\b/i;
    const nameIndicators = /\b(pub|inn|tavern|hotel|house|arms|head|bell|crown|swan|bull|lion|rose|anchor|castle|oak|fox|bear|eagle|plough|cafe|coffee|restaurant|bistro|kitchen|hall|centre|center|church|chapel|farm|barn|manor|lodge|cottage|the\s+\w+)\b/i;

    let nameIndex = -1;
    let firstNonStreetIndex = -1;

    filteredParts.forEach((part, index) => {
      const hasStreetIndicator = streetIndicators.test(part);
      const hasNameIndicator = nameIndicators.test(part);

      if (hasNameIndicator && nameIndex === -1) {
        nameIndex = index;
      }
      if (!hasStreetIndicator && firstNonStreetIndex === -1) {
        firstNonStreetIndex = index;
      }
    });

    if (nameIndex === -1 && firstNonStreetIndex !== -1) {
      nameIndex = firstNonStreetIndex;
    }

    if (nameIndex !== -1) {
      result.name = filteredParts[nameIndex];
    }

    const addressParts = filteredParts.filter((_, index) => index !== nameIndex);

    const streetIndex = addressParts.findIndex(part => streetIndicators.test(part));
    if (streetIndex !== -1) {
      result.address1 = addressParts[streetIndex];
      const remaining = addressParts.filter((_, i) => i !== streetIndex);
      if (remaining.length > 0) {
        result.address2 = remaining[0];
      }
    } else {
      addressParts.forEach((part, index) => {
        if (index === 0) {
          result.address1 = part;
        } else if (index === 1) {
          result.address2 = part;
        }
      });
    }

    return result;
  }

  private removePostcodeFromPart(part: string, postcode: string | null): string {
    if (!postcode) {
      return part;
    }
    const postcodePattern = new RegExp(postcode.replace(/\s/g, "\\s*"), "gi");
    return part.replace(postcodePattern, "").trim();
  }

  private cleanAddressLine(line: string): string {
    return line
      .replace(/^[-,.\s]+/, "")
      .replace(/[-,.\s]+$/, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  private inferVenueType(text: string, name: string): string {
    return inferVenueTypeFromName(text + " " + name);
  }
}
