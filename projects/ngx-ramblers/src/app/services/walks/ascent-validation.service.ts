import { inject, Injectable } from "@angular/core";
import isEmpty from "lodash-es/isEmpty";
import { DistanceUnit, Walk, WalkAscent } from "../../models/walk.model";
import { NumberUtilsService } from "../number-utils.service";

@Injectable({
  providedIn: "root"
})

export class AscentValidationService {
  private numberUtils = inject(NumberUtilsService);
  private FEET_TO_METRES_FACTOR = 0.3048;

  parse(walk: Walk): WalkAscent {
    return {
      rawData: walk.ascent || null,
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

  walkAscentFeet(walk: Walk): number {
    const ascentItems = this.ascentItems(walk);
    if (ascentItems.length > 0) {
      const units: DistanceUnit = this.ascentUnits(ascentItems);
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

  walkAscentMetres(walk): number {
    const ascentItems = this.ascentItems(walk);
    if (ascentItems.length > 0) {
      const units: DistanceUnit = this.ascentUnits(ascentItems);
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

  private validationMessage(walk: Walk) {
    const ascentItems = this.ascentItems(walk);
    const units: DistanceUnit = this.ascentUnits(ascentItems);
    if (!isEmpty(walk?.ascent)) {
      if (units === DistanceUnit.UNKNOWN) {
        return `Ascent in feet should be entered or feet or metres can be entered after the ascent, but "${ascentItems[1]}" was entered`;
      } else {
        return null;
      }
    } else {
      return null;
    }
  }

  private ascentUnits(ascentItems: string[]): DistanceUnit {
    if (ascentItems.length === 0) {
      return DistanceUnit.UNKNOWN;
    } else {
      const units = ascentItems.length > 1 ? ascentItems[1] : null;
      if (units === null || units.toLowerCase().startsWith("f")) {
        return DistanceUnit.FEET;
      } else if (units.toLowerCase().startsWith("m")) {
        return DistanceUnit.METRES;
      } else {
        return DistanceUnit.UNKNOWN;
      }
    }
  }

  walkAscents(walk: Walk) {
    return `${this.walkAscentFeetAsString(walk)} / ${this.walkAscentMetresAsString(walk)}`;
  }

  private ascentItems(walk: Walk): string[] {
    return walk?.ascent?.split(" ")?.map(item => item.trim())?.filter(item => item) || [];
  }

  walkAscentFeetAsString(walk) {
    return this.walkAscentFeet(walk) > 0 ? `${this.walkAscentFeet(walk)} ft` : "";
  }

  walkAscentMetresAsString(walk) {
    return this.walkAscentMetres(walk) > 0 ? `${this.walkAscentMetres(walk)} m` : "";
  }

}
