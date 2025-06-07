import { inject, Injectable } from "@angular/core";
import isEmpty from "lodash-es/isEmpty";
import { DistanceUnit, WalkAscent } from "../../models/walk.model";
import { NumberUtilsService } from "../number-utils.service";
import { ExtendedGroupEvent, FEET_TO_METRES_FACTOR, GroupEvent } from "../../models/group-event.model";

@Injectable({
  providedIn: "root"
})

export class AscentValidationService {
  private numberUtils = inject(NumberUtilsService);

  parse(walk: ExtendedGroupEvent): WalkAscent {
    return {
      rawData: walk.groupEvent.ascent_feet || null,
      feet: {
        value: this.walkAscentFeet(walk),
        valueAsString: (this.walkAscentFeet(walk) || "").toString(),
        formatted: this.walkAscentFeetAsString(walk)
      },
      metres: {
        value: this.walkAscentMetres(walk),
        valueAsString: (this.walkAscentMetres(walk) || "").toString(),
        formatted: this.walkAscentMetresAsString(walk)
      },
      validationMessage: this.validationMessage(walk),
    };
  }

  public walkAscentFeet(walk: ExtendedGroupEvent): number {
    if (walk?.groupEvent?.ascent_feet > 0) {
      return walk?.groupEvent?.ascent_feet;
    } else {
      const ascentMetres = walk?.groupEvent?.ascent_metres;
      if (ascentMetres > 0) {
        return this.convertMetresToFeet(ascentMetres);
      } else {
        return null;
      }
    }
  }

  public convertMetresToFeet(ascentMetres: number) {
    return this.numberUtils.asNumber(ascentMetres / FEET_TO_METRES_FACTOR, 1);
  }

  public walkAscentMetres(walk: ExtendedGroupEvent): number {
    if (walk?.groupEvent?.ascent_metres > 0) {
      return walk?.groupEvent?.ascent_metres;
    } else {
      const ascentFeet = walk?.groupEvent?.ascent_feet;
      if (ascentFeet > 0) {
        return this.convertFeetToMetres(ascentFeet);
      } else {
        return null;
      }
    }
  }

  public convertFeetToMetres(ascentFeet: number) {
    return this.numberUtils.asNumber(ascentFeet * FEET_TO_METRES_FACTOR, 1);
  }

  private validationMessage(walk: ExtendedGroupEvent) {
    const units: DistanceUnit = this.ascentUnits(walk.groupEvent);
    if (!isEmpty(walk.groupEvent?.ascent_feet)) {
      if (units === DistanceUnit.UNKNOWN) {
        return `Ascent in feet or metres can be entered, but ${walk.groupEvent.ascent_feet} ${DistanceUnit.FEET} / ${walk.groupEvent.ascent_metres} ${DistanceUnit.METRES} was entered`;
      } else {
        return null;
      }
    } else {
      return null;
    }
  }

  private ascentUnits(groupEvent: GroupEvent): DistanceUnit {
    if (!!!groupEvent.ascent_feet && !!!groupEvent.ascent_metres) {
      return DistanceUnit.UNKNOWN;
    } else if (!!groupEvent.ascent_feet) {
        return DistanceUnit.FEET;
    } else if (!!groupEvent.ascent_metres) {
        return DistanceUnit.METRES;
      } else {
        return DistanceUnit.UNKNOWN;
      }
    }

  walkAscents(walk: ExtendedGroupEvent) {
    return `${this.walkAscentFeetAsString(walk)} / ${this.walkAscentMetresAsString(walk)}`;
  }

  walkAscentFeetAsString(walk: ExtendedGroupEvent) {
    return this.walkAscentFeet(walk) > 0 ? `${this.walkAscentFeet(walk)} ${DistanceUnit.FEET}` : "";
  }

  walkAscentMetresAsString(walk: ExtendedGroupEvent) {
    return this.walkAscentMetres(walk) > 0 ? `${this.walkAscentMetres(walk)} ${DistanceUnit.METRES}` : "";
  }

}
