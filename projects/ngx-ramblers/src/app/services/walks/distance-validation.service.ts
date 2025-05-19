import { Injectable } from "@angular/core";
import { DistanceUnit, WalkDistance } from "../../models/walk.model";
import { ExtendedGroupEvent } from "../../models/group-event.model";

@Injectable({
  providedIn: "root"
})

export class DistanceValidationService {
  private MILES_TO_KILOMETRES_FACTOR = 1.60934;

  parse(walk: ExtendedGroupEvent): WalkDistance {
    return {
      rawData: this.rawData(walk),
      miles: {
        value: this.walkDistanceMiles(walk),
        valueAsString: (this.walkDistanceMiles(walk)).toString(),
        formatted: this.walkDistanceMilesAsString(walk)
      },
      kilometres: {
        value: this.walkDistanceKilometres(walk),
        valueAsString: (this.walkDistanceKilometres(walk)).toString(),
        formatted: this.walkDistanceKilometresAsString(walk)
      },
      validationMessage: this.validationMessage(walk),
    };
  }
  convertMilesToKm(miles: number): number {
    return parseFloat((miles * this.MILES_TO_KILOMETRES_FACTOR).toFixed(2));
  }

  convertKmToMiles(km: number): number {
    return parseFloat((km / this.MILES_TO_KILOMETRES_FACTOR).toFixed(2));
  }
  walkDistanceMiles(walk: ExtendedGroupEvent): number {
    if (walk.groupEvent.distance_miles > 0) {
      return walk.groupEvent.distance_miles;
    } else if (walk.groupEvent.distance_km > 0) {
      return walk.groupEvent.distance_km / this.MILES_TO_KILOMETRES_FACTOR;
    } else return 0;
  }

  walkDistanceKilometres(walk: ExtendedGroupEvent): number {
    if (walk.groupEvent.distance_km > 0) {
      return walk.groupEvent.distance_km;
    } else if (walk.groupEvent.distance_miles > 0) {
      return walk.groupEvent.distance_miles * this.MILES_TO_KILOMETRES_FACTOR;
    } else return 0;
  }

  private validationMessage(walk: ExtendedGroupEvent) {
    const units: DistanceUnit = this.distanceUnits(walk);
    if (walk?.groupEvent?.distance_miles > 0) {
      if (units === DistanceUnit.UNKNOWN) {
        const distance = this.rawData(walk);
        return `Distance in miles should be entered or miles or kilometres can be entered after the distance, but "${distance}" was entered`;
      } else {
        return null;
      }
    } else {
      return "Distance is missing";
    }
  }

  private rawData(walk: ExtendedGroupEvent): string {
    return walk.groupEvent?.distance_miles ? (`${walk.groupEvent.distance_miles} miles`) : walk.groupEvent?.distance_km ? (`${walk.groupEvent.distance_km} km`) : "nothing";
  }

  private distanceUnits(walk: ExtendedGroupEvent): DistanceUnit {
    if (walk?.groupEvent?.distance_miles > 0) {
      return DistanceUnit.MILES;
    } else if (walk.groupEvent.distance_km > 0) {
      return DistanceUnit.KILOMETRES;
    } else {
      return DistanceUnit.UNKNOWN;
    }
  }

  walkDistances(walk: ExtendedGroupEvent) {
    return `${this.walkDistanceMilesAsString(walk)} / ${this.walkDistanceKilometresAsString(walk)}`;
  }

  walkDistanceMilesAsString(walk) {
    return this.walkDistanceMiles(walk) > 0 ? `${this.walkDistanceMiles(walk)} mi` : "";
  }

  walkDistanceKilometresAsString(walk) {
    return this.walkDistanceKilometres(walk) > 0 ? `${this.walkDistanceKilometres(walk)} km` : "";
  }

}
