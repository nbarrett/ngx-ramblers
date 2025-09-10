import { inject, Injectable } from "@angular/core";
import { isEmpty } from "es-toolkit/compat";
import { DistanceUnit, WalkAscent } from "../../models/walk.model";
import { NumberUtilsService } from "../number-utils.service";
import { ExtendedGroupEvent, FEET_TO_METRES_FACTOR, GroupEvent } from "../../models/group-event.model";

@Injectable({
  providedIn: "root"
})

export class AscentValidationService {
  private numberUtils = inject(NumberUtilsService);

  parse(extendedGroupEvent: ExtendedGroupEvent): WalkAscent {
    return {
      rawData: extendedGroupEvent?.groupEvent?.ascent_feet || null,
      feet: {
        value: this.walkAscentFeet(extendedGroupEvent),
        valueAsString: (this.walkAscentFeet(extendedGroupEvent) || "").toString(),
        formatted: this.walkAscentFeetAsString(extendedGroupEvent)
      },
      metres: {
        value: this.walkAscentMetres(extendedGroupEvent),
        valueAsString: (this.walkAscentMetres(extendedGroupEvent) || "").toString(),
        formatted: this.walkAscentMetresAsString(extendedGroupEvent)
      },
      validationMessage: this.validationMessage(extendedGroupEvent),
    };
  }

  public walkAscentFeet(extendedGroupEvent: ExtendedGroupEvent): number {
    if (extendedGroupEvent?.groupEvent?.ascent_feet > 0) {
      return extendedGroupEvent?.groupEvent?.ascent_feet;
    } else {
      const ascentMetres = extendedGroupEvent?.groupEvent?.ascent_metres;
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

  public walkAscentMetres(extendedGroupEvent: ExtendedGroupEvent): number {
    if (extendedGroupEvent?.groupEvent?.ascent_metres > 0) {
      return extendedGroupEvent?.groupEvent?.ascent_metres;
    } else {
      const ascentFeet = extendedGroupEvent?.groupEvent?.ascent_feet;
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

  private validationMessage(extendedGroupEvent: ExtendedGroupEvent) {
    const units: DistanceUnit = this.ascentUnits(extendedGroupEvent?.groupEvent);
    if (!isEmpty(extendedGroupEvent?.groupEvent?.ascent_feet)) {
      if (units === DistanceUnit.UNKNOWN) {
        return `Ascent in feet or metres can be entered, but ${extendedGroupEvent?.groupEvent?.ascent_feet} ${DistanceUnit.FEET} / ${extendedGroupEvent?.groupEvent?.ascent_metres} ${DistanceUnit.METRES} was entered`;
      } else {
        return null;
      }
    } else {
      return null;
    }
  }

  private ascentUnits(groupEvent: GroupEvent): DistanceUnit {
    if (!!!groupEvent?.ascent_feet && !!!groupEvent?.ascent_metres) {
      return DistanceUnit.UNKNOWN;
    } else if (!!groupEvent.ascent_feet) {
        return DistanceUnit.FEET;
    } else if (!!groupEvent.ascent_metres) {
        return DistanceUnit.METRES;
      } else {
        return DistanceUnit.UNKNOWN;
      }
    }

  walkAscents(extendedGroupEvent: ExtendedGroupEvent) {
    return `${this.walkAscentFeetAsString(extendedGroupEvent)} / ${this.walkAscentMetresAsString(extendedGroupEvent)}`;
  }

  walkAscentFeetAsString(extendedGroupEvent: ExtendedGroupEvent) {
    return this.walkAscentFeet(extendedGroupEvent) > 0 ? `${this.walkAscentFeet(extendedGroupEvent)} ${DistanceUnit.FEET}` : "";
  }

  walkAscentMetresAsString(extendedGroupEvent: ExtendedGroupEvent) {
    return this.walkAscentMetres(extendedGroupEvent) > 0 ? `${this.walkAscentMetres(extendedGroupEvent)} ${DistanceUnit.METRES}` : "";
  }

}
