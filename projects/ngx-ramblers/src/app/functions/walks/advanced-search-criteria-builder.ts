import { AdvancedSearchCriteria } from "../../models/search.model";
import { EventField, GroupEventField } from "../../models/walk.model";
import { DateUtilsService } from "../../services/date-utils.service";
import { Logger } from "../../services/logger-factory.service";
import { isMongoId } from "../../services/mongo-utils";
import { isRamblersContactId } from "../../services/ramblers-utils";
import { isNumber } from "es-toolkit/compat";

export interface CriteriaBuilderOptions {
  advancedSearchCriteria?: AdvancedSearchCriteria;
  dateUtils: DateUtilsService;
  walkPopulationLocal?: boolean;
  logger?: Logger;
}

export function buildProximityCriteria(
  lat: number,
  lng: number,
  radiusMiles: number
): any {
  const radiusDegrees = radiusMiles / 69;
  const minLat = lat - radiusDegrees;
  const maxLat = lat + radiusDegrees;
  const minLng = lng - (radiusDegrees / Math.cos(lat * Math.PI / 180));
  const maxLng = lng + (radiusDegrees / Math.cos(lat * Math.PI / 180));

  return {
    $and: [
      { [GroupEventField.START_LOCATION_LATITUDE]: { $gte: minLat, $lte: maxLat } },
      { [GroupEventField.START_LOCATION_LONGITUDE]: { $gte: minLng, $lte: maxLng } }
    ]
  };
}

export function buildDaysOfWeekCriteria(
  daysOfWeek: string[],
  dateUtils: DateUtilsService
): any | null {
  const mongoDayValues = daysOfWeek
    .map(day => dateUtils.mongoDayOfWeekFromName(day))
    .filter(value => isNumber(value));

  if (mongoDayValues.length === 0) {
    return null;
  } else {
    return {
      $expr: {
        $in: [
          { $dayOfWeek: { $toDate: `$${GroupEventField.START_DATE}` } },
          mongoDayValues
        ]
      }
    };
  }
}

export function buildDifficultyCriteria(difficulty: string[]): any {
  return {
    [`${GroupEventField.DIFFICULTY}.description`]: { $in: difficulty }
  };
}

export function buildDistanceRangeCriteria(
  distanceMin?: number,
  distanceMax?: number
): any | null {
  const hasValidMin = isNumber(distanceMin) && !isNaN(distanceMin);
  const hasValidMax = isNumber(distanceMax) && !isNaN(distanceMax);

  if (!hasValidMin && !hasValidMax) {
    return null;
  } else {
    const distanceCriteria: any = {};
    if (hasValidMin) {
      distanceCriteria.$gte = distanceMin;
    }
    if (hasValidMax) {
      distanceCriteria.$lte = distanceMax;
    }

    return {
      [GroupEventField.DISTANCE_MILES]: distanceCriteria
    };
  }
}

export function buildAccessibilityCriteria(accessibility: string[]): any {
  return {
    [`${GroupEventField.ACCESSIBILITY}.description`]: { $in: accessibility }
  };
}

export function buildFacilitiesCriteria(facilities: string[]): any {
  return {
    [`${GroupEventField.FACILITIES}.description`]: { $in: facilities }
  };
}

export function buildFreeOnlyCriteria(): any {
  return {
    $or: [
      { [GroupEventField.EXTERNAL_URL]: { $exists: false } },
      { [GroupEventField.EXTERNAL_URL]: null },
      { [GroupEventField.EXTERNAL_URL]: "" }
    ]
  };
}

export function buildcancelledCriteria(): any {
  return {
    [GroupEventField.STATUS]: { $regex: "^cancelled$", $options: "i" }
  };
}

function latLngMissingOrInvalid(field: GroupEventField): any[] {
  return [
    { [field]: { $exists: false } },
    { [field]: null },
    { [field]: 0 },
    { [field]: { $gt: -0.001, $lt: 0.001 } }
  ];
}

function locationMissingCriteria(latField: GroupEventField, lngField: GroupEventField): any {
  return {
    $and: [
      { $or: latLngMissingOrInvalid(latField) },
      { $or: latLngMissingOrInvalid(lngField) }
    ]
  };
}

export function buildNoLocationCriteria(): any {
  return {
    $and: [
      locationMissingCriteria(
        GroupEventField.START_LOCATION_LATITUDE,
        GroupEventField.START_LOCATION_LONGITUDE
      ),
      locationMissingCriteria(
        GroupEventField.LOCATION_LATITUDE,
        GroupEventField.LOCATION_LONGITUDE
      )
    ]
  };
}

function extractLeaderMatchPatterns(leaderId: string): { groupCode?: string; namePattern?: string } {
  const parts = leaderId.split("-");
  if (parts.length >= 2) {
    const firstPart = parts[0].toUpperCase();
    const secondPart = parts[1];
    const isGroupCodeWithDigits = /^\d+$/.test(secondPart);

    let groupCode: string;
    let nameParts: string[];

    if (isGroupCodeWithDigits) {
      groupCode = firstPart + secondPart.toUpperCase();
      nameParts = parts.slice(2);
    } else {
      groupCode = firstPart;
      nameParts = parts.slice(1);
    }

    const namePart = nameParts.join(" ");
    const namePattern = namePart.replace(/\s+/g, ".*");
    return { groupCode, namePattern };
  }
  return {};
}

export function buildLeaderIdsCriteria(leaderIds: string[], walkPopulationLocal?: boolean, logger?: Logger): any {
  const mongoIds = leaderIds.filter(id => isMongoId(id));
  const compositeIds = leaderIds.filter(id => !isMongoId(id));
  const ramblersIds = compositeIds.filter(id => isRamblersContactId(id));
  const slugIds = compositeIds.filter(id => !isRamblersContactId(id));
  const orConditions: any[] = [];

  logger?.debug("buildLeaderIdsCriteria: leaderIds:", leaderIds, "mongoIds:", mongoIds, "compositeIds:", compositeIds);

  if (mongoIds.length > 0) {
    orConditions.push({ [EventField.CONTACT_DETAILS_MEMBER_ID]: { $in: mongoIds } });
  }

  if (ramblersIds.length > 0) {
    orConditions.push({
      $or: [
        { [GroupEventField.WALK_LEADER_ID]: { $in: ramblersIds } },
        { [EventField.CONTACT_DETAILS_CONTACT_ID]: { $in: ramblersIds } }
      ]
    });
  }

  if (slugIds.length > 0) {
    slugIds.forEach(leaderId => {
      const { groupCode, namePattern } = extractLeaderMatchPatterns(leaderId);
      logger?.debug("buildLeaderIdsCriteria: leaderId:", leaderId, "extracted groupCode:", groupCode, "namePattern:", namePattern);
      if (groupCode && namePattern) {
        orConditions.push({
          $and: [
            { [GroupEventField.GROUP_CODE]: { $regex: `^${groupCode}$`, $options: "i" } },
            {
              $or: [
                { [GroupEventField.WALK_LEADER_NAME]: { $regex: namePattern, $options: "i" } },
                { [EventField.CONTACT_DETAILS_DISPLAY_NAME]: { $regex: namePattern, $options: "i" } },
                { [GroupEventField.WALK_LEADER_TELEPHONE]: { $regex: namePattern.replace(/\s/g, ""), $options: "i" } }
              ]
            }
          ]
        });
      }
    });
  }

  const result = orConditions.length === 0
    ? { _id: { $exists: false } }
    : orConditions.length === 1
      ? orConditions[0]
      : { $or: orConditions };

  logger?.debug("buildLeaderIdsCriteria: result:", JSON.stringify(result, null, 2));
  return result;
}

export function buildGroupCodesCriteria(groupCodes: string[]): any {
  if (groupCodes.length === 1) {
    return {
      [GroupEventField.GROUP_CODE]: { $regex: `^${groupCodes[0]}$`, $options: "i" }
    };
  }
  return {
    $or: groupCodes.map(code => ({
      [GroupEventField.GROUP_CODE]: { $regex: `^${code}$`, $options: "i" }
    }))
  };
}

export function buildAdvancedSearchCriteria(
  options: CriteriaBuilderOptions
): any[] {
  const { advancedSearchCriteria, dateUtils, walkPopulationLocal, logger } = options;
  const criteriaParts: any[] = [];

  if (!advancedSearchCriteria) {
    return criteriaParts;
  } else {
    if (advancedSearchCriteria.leaderIds?.length) {
      criteriaParts.push(buildLeaderIdsCriteria(advancedSearchCriteria.leaderIds, walkPopulationLocal, logger));
    }

    if (advancedSearchCriteria.groupCodes?.length) {
      criteriaParts.push(buildGroupCodesCriteria(advancedSearchCriteria.groupCodes));
    }

    logger?.debug("Checking proximity criteria:", {
      proximityLat: advancedSearchCriteria.proximityLat,
      proximityLng: advancedSearchCriteria.proximityLng,
      proximityRadiusMiles: advancedSearchCriteria.proximityRadiusMiles,
      hasLat: !!advancedSearchCriteria.proximityLat,
      hasLng: !!advancedSearchCriteria.proximityLng,
      hasRadius: !!advancedSearchCriteria.proximityRadiusMiles
    });

    if (
      advancedSearchCriteria.proximityLat &&
      advancedSearchCriteria.proximityLng &&
      advancedSearchCriteria.proximityRadiusMiles
    ) {
      logger?.debug("Adding proximity criteria to search");
      criteriaParts.push(
        buildProximityCriteria(
          advancedSearchCriteria.proximityLat,
          advancedSearchCriteria.proximityLng,
          advancedSearchCriteria.proximityRadiusMiles
        )
      );
    } else {
      logger?.debug("Proximity criteria NOT added - one or more values are falsy");
    }

    if (advancedSearchCriteria.daysOfWeek?.length) {
      const daysCriteria = buildDaysOfWeekCriteria(advancedSearchCriteria.daysOfWeek, dateUtils);
      if (daysCriteria) {
        criteriaParts.push(daysCriteria);
      }
    }

    if (advancedSearchCriteria.difficulty?.length) {
      criteriaParts.push(buildDifficultyCriteria(advancedSearchCriteria.difficulty));
    }

    const distanceCriteria = buildDistanceRangeCriteria(
      advancedSearchCriteria.distanceMin,
      advancedSearchCriteria.distanceMax
    );
    if (distanceCriteria) {
      criteriaParts.push(distanceCriteria);
    }

    if (advancedSearchCriteria.accessibility?.length) {
      criteriaParts.push(buildAccessibilityCriteria(advancedSearchCriteria.accessibility));
    }

    if (advancedSearchCriteria.facilities?.length) {
      criteriaParts.push(buildFacilitiesCriteria(advancedSearchCriteria.facilities));
    }

    if (advancedSearchCriteria.freeOnly) {
      criteriaParts.push(buildFreeOnlyCriteria());
    }

    if (advancedSearchCriteria.cancelled) {
      criteriaParts.push(buildcancelledCriteria());
    }

    if (advancedSearchCriteria.noLocation) {
      criteriaParts.push(buildNoLocationCriteria());
    }

    return criteriaParts;
  }
}
