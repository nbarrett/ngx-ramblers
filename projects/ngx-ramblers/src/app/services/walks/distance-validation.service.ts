import { Injectable } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { DistanceUnit, Walk, WalkDistance } from "../../models/walk.model";
import { Logger, LoggerFactory } from "../logger-factory.service";
import { NumberUtilsService } from "../number-utils.service";

@Injectable({
  providedIn: "root"
})

export class DistanceValidationService {
  private logger: Logger;
  private MILES_TO_KILOMETRES_FACTOR = 1.60934;

  constructor(
    private numberUtils: NumberUtilsService,
    loggerFactory: LoggerFactory) {
    this.logger = loggerFactory.createLogger("DistanceService", NgxLoggerLevel.OFF);
  }

  parse(walk: Walk): WalkDistance {
    return {
      rawData: walk.distance,
      miles: {
        value: this.walkDistanceMiles(walk),
        valueAsString: (this.walkDistanceMiles(walk) || "").toString(),
        formatted: this.walkDistanceMilesAsString(walk)
      },
      kilometres: {
        value: this.walkDistanceKilometres(walk),
        valueAsString: (this.walkDistanceKilometres(walk) || "").toString(),
        formatted: this.walkDistanceKilometresAsString(walk)
      },
      validationMessage: this.validationMessage(walk),
    };
  }

  walkDistanceMiles(walk: Walk): number {
    const distanceItems = this.distanceItems(walk);
    const units: DistanceUnit = this.distanceUnits(distanceItems);
    const numericDistance = this.numberUtils.asNumber(distanceItems[0]);
    switch (units) {
      case DistanceUnit.MILES:
        return this.numberUtils.asNumber(numericDistance, 1);
      case DistanceUnit.KILOMETRES:
        return this.numberUtils.asNumber(numericDistance / this.MILES_TO_KILOMETRES_FACTOR, 1);
      case DistanceUnit.UNKNOWN:
        break;
    }
  }

  walkDistanceKilometres(walk: Walk): number {
    const distanceItems = this.distanceItems(walk);
    const units: DistanceUnit = this.distanceUnits(distanceItems);
    const numericDistance = this.numberUtils.asNumber(distanceItems[0]);
    switch (units) {
      case DistanceUnit.MILES:
        return this.numberUtils.asNumber(numericDistance * this.MILES_TO_KILOMETRES_FACTOR, 1);
      case DistanceUnit.KILOMETRES:
        return this.numberUtils.asNumber(numericDistance, 1);
      case DistanceUnit.UNKNOWN:
        break;
    }
  }

  private validationMessage(walk: Walk) {
    const distanceItems = this.distanceItems(walk);
    const units: DistanceUnit = this.distanceUnits(distanceItems);
    if (walk?.distance?.length > 0) {
      if (units === DistanceUnit.UNKNOWN) {
        return `Distance in miles should be entered or miles or kilometres can be entered after the distance, but "${distanceItems[1]}" was entered`;
      } else {
        return null;
      }
    } else {
      return "Distance is missing";
    }
  }

  private distanceUnits(distanceItems: string[]): DistanceUnit {
    const units = distanceItems.length > 1 ? distanceItems[1] : null;
    if (units === null || units.toLowerCase().startsWith("m")) {
      return DistanceUnit.MILES;
    } else if (units.toLowerCase().startsWith("k")) {
      return DistanceUnit.KILOMETRES;
    } else {
      return DistanceUnit.UNKNOWN;
    }
  }

  walkDistances(walk: Walk) {
    return `${this.walkDistanceMilesAsString(walk)} / ${this.walkDistanceKilometresAsString(walk)}`;
  }

  private distanceItems(walk: Walk): string[] {
    return walk?.distance?.split(" ")?.map(item => item.trim())?.filter(item => item) || [];
  }

  walkDistanceMilesAsString(walk) {
    return this.walkDistanceMiles(walk) !== null ? `${this.walkDistanceMiles(walk)} mi` : "";
  }

  walkDistanceKilometresAsString(walk) {
    return this.walkDistanceMiles(walk) !== null ? `${this.walkDistanceKilometres(walk)} km` : "";
  }

}
