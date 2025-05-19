import { Injectable } from "@angular/core";
import { DistanceUnit, WalkDistance } from "../../models/walk.model";
import { ExtendedGroupEvent } from "../../models/group-event.model";

@Injectable({
  providedIn: "root"
})

export class DistanceValidationService {
  private MILES_TO_KILOMETRES_FACTOR = 1.60934;

  parse(extendedGroupEvent: ExtendedGroupEvent): WalkDistance {
    return {
      rawData: this.rawData(extendedGroupEvent),
      miles: {
        value: this.distanceMiles(extendedGroupEvent),
        valueAsString: (this.distanceMiles(extendedGroupEvent)).toString(),
        formatted: this.walkDistanceMilesAsString(extendedGroupEvent)
      },
      kilometres: {
        value: this.distanceKilometres(extendedGroupEvent),
        valueAsString: (this.distanceKilometres(extendedGroupEvent)).toString(),
        formatted: this.walkDistanceKilometresAsString(extendedGroupEvent)
      },
      validationMessage: this.validationMessage(extendedGroupEvent),
    };
  }
  convertMilesToKm(miles: number): number {
    return parseFloat((miles * this.MILES_TO_KILOMETRES_FACTOR).toFixed(2));
  }

  convertKmToMiles(km: number): number {
    return parseFloat((km / this.MILES_TO_KILOMETRES_FACTOR).toFixed(2));
  }

  distanceMiles(extendedGroupEvent: ExtendedGroupEvent): number {
    if (extendedGroupEvent.groupEvent.distance_miles > 0) {
      return extendedGroupEvent.groupEvent.distance_miles;
    } else if (extendedGroupEvent.groupEvent.distance_km > 0) {
      return extendedGroupEvent.groupEvent.distance_km / this.MILES_TO_KILOMETRES_FACTOR;
    } else return 0;
  }

  distanceKilometres(extendedGroupEvent: ExtendedGroupEvent): number {
    if (extendedGroupEvent.groupEvent.distance_km > 0) {
      return extendedGroupEvent.groupEvent.distance_km;
    } else if (extendedGroupEvent.groupEvent.distance_miles > 0) {
      return extendedGroupEvent.groupEvent.distance_miles * this.MILES_TO_KILOMETRES_FACTOR;
    } else return 0;
  }

  private validationMessage(extendedGroupEvent: ExtendedGroupEvent) {
    const units: DistanceUnit = this.distanceUnits(extendedGroupEvent);
    if (extendedGroupEvent?.groupEvent?.distance_miles > 0) {
      if (units === DistanceUnit.UNKNOWN) {
        const distance = this.rawData(extendedGroupEvent);
        return `Distance in miles should be entered or miles or kilometres can be entered after the distance, but "${distance}" was entered`;
      } else {
        return null;
      }
    } else {
      return "Distance is missing";
    }
  }

  private rawData(extendedGroupEvent: ExtendedGroupEvent): string {
    return extendedGroupEvent.groupEvent?.distance_miles ? (`${extendedGroupEvent.groupEvent.distance_miles} miles`) : extendedGroupEvent.groupEvent?.distance_km ? (`${extendedGroupEvent.groupEvent.distance_km} km`) : "nothing";
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

  walkDistances(extendedGroupEvent: ExtendedGroupEvent) {
    const delimiter = extendedGroupEvent?.groupEvent?.distance_miles && extendedGroupEvent?.groupEvent?.distance_km ? " / " : "";
    return `${this.walkDistanceMilesAsString(extendedGroupEvent)}${delimiter}${this.walkDistanceKilometresAsString(extendedGroupEvent)}`.trim();
  }

  walkDistanceMilesAsString(walk) {
    return this.distanceMiles(walk) > 0 ? `${this.distanceMiles(walk)} ${DistanceUnit.MILES}` : "";
  }

  walkDistanceKilometresAsString(walk) {
    return this.distanceKilometres(walk) > 0 ? `${this.distanceKilometres(walk)} ${DistanceUnit.KILOMETRES}` : "";
  }

}
