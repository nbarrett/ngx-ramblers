import { inject, Injectable } from "@angular/core";
import isEmpty from "lodash-es/isEmpty";
import { DistanceUnit, WalkAscent } from "../../models/walk.model";
import { NumberUtilsService } from "../number-utils.service";
import { ExtendedGroupEvent, GroupEvent } from "../../models/group-event.model";

@Injectable({
  providedIn: "root"
})

export class AscentValidationService {
  private numberUtils = inject(NumberUtilsService);
  private FEET_TO_METRES_FACTOR = 0.3048;

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

  walkAscentFeet(walk: ExtendedGroupEvent): number {
    const ascentItems = this.ascentItems(walk);
    if (ascentItems.length > 0) {
      const units: DistanceUnit = this.ascentUnits(walk.groupEvent);
      const numericAscent = this.numberUtils.asNumber(ascentItems[0]);
      switch (units) {
        case DistanceUnit.FEET:
          return this.numberUtils.asNumber(numericAscent, 1);
        case DistanceUnit.METRES:
          return this.numberUtils.asNumber(numericAscent / this.FEET_TO_METRES_FACTOR, 1);
        case DistanceUnit.UNKNOWN:
          return null;
      }
    } else {
      return null;
    }
  }

  walkAscentMetres(walk: ExtendedGroupEvent): number {
    const ascentItems = this.ascentItems(walk);
    if (ascentItems.length > 0) {
      const units: DistanceUnit = this.ascentUnits(walk.groupEvent);
      const numericAscent = this.numberUtils.asNumber(ascentItems[0]);
      switch (units) {
        case DistanceUnit.FEET:
          return this.numberUtils.asNumber(numericAscent * this.FEET_TO_METRES_FACTOR, 1);
        case DistanceUnit.METRES:
          return this.numberUtils.asNumber(numericAscent, 1);
        case DistanceUnit.UNKNOWN:
          return null;
      }
    } else {
      return null;
    }
  }

  private validationMessage(walk: ExtendedGroupEvent) {
    const ascentItems = this.ascentItems(walk);
    const units: DistanceUnit = this.ascentUnits(walk.groupEvent);
    if (!isEmpty(walk.groupEvent?.ascent_feet)) {
      if (units === DistanceUnit.UNKNOWN) {
        return `Ascent in feet should be entered or feet or metres can be entered after the ascent, but "${ascentItems[1]}" was entered`;
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

  private ascentItems(walk: ExtendedGroupEvent): number[] {
    return walk.groupEvent?.ascent_feet ? [walk.groupEvent?.ascent_feet] : [];
  }

  walkAscentFeetAsString(walk: ExtendedGroupEvent) {
    return this.walkAscentFeet(walk) > 0 ? `${this.walkAscentFeet(walk)} ft` : "";
  }

  walkAscentMetresAsString(walk: ExtendedGroupEvent) {
    return this.walkAscentMetres(walk) > 0 ? `${this.walkAscentMetres(walk)} m` : "";
  }

}
