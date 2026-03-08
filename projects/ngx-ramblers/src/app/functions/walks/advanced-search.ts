import { ParamMap } from "@angular/router";
import { isArray, isBoolean, isNull, isNumber, isUndefined, keys, values } from "es-toolkit/compat";
import { DateTime } from "luxon";
import { AdvancedSearchCriteria, AdvancedSearchFieldType, ADVANCED_SEARCH_CRITERIA_FIELDS, WalkLeaderOption } from "../../models/search.model";
import { DateDirection, SavedSearchCriteria } from "../../models/search.model";
import { UIDateFormat } from "../../models/date-format.model";
import { StoredValue } from "../../models/ui-actions";
import { StringUtilsService } from "../../services/string-utils.service";
import { DateUtilsService } from "../../services/date-utils.service";

const DATE_STORED_VALUES: Set<StoredValue> = new Set([StoredValue.DATE_FROM, StoredValue.DATE_TO]);

function parseDateOrNumber(value: string): number | undefined {
  const numeric = Number(value);
  if (!Number.isNaN(numeric)) {
    return numeric;
  }
  const parsedDate = Date.parse(value);
  return Number.isNaN(parsedDate) ? undefined : parsedDate;
}

export function advancedSearchCriteriaFromParams(params: ParamMap, stringUtils: StringUtilsService, leaderOptions: WalkLeaderOption[] = []): AdvancedSearchCriteria | null {
  const criteria: Partial<AdvancedSearchCriteria> = {};
  const assignValue = (key: keyof AdvancedSearchCriteria, value: AdvancedSearchCriteria[keyof AdvancedSearchCriteria]) => {
    const target = criteria as Record<keyof AdvancedSearchCriteria, AdvancedSearchCriteria[keyof AdvancedSearchCriteria]>;
    target[key] = value;
  };

  const labelToIdMap = new Map<string, string>();
  leaderOptions.forEach(option => {
    const targetId = option.id;
    const allLabels = option.allLabels || [option.label];
    const allIds = option.allIds || [option.id];
    allLabels.forEach(label => {
      const kebabLabel = stringUtils.kebabCase(label);
      labelToIdMap.set(kebabLabel, targetId);
    });
    allIds.forEach(id => {
      labelToIdMap.set(id, targetId);
    });
  });

  ADVANCED_SEARCH_CRITERIA_FIELDS.forEach(field => {
    const queryKey = stringUtils.kebabCase(field.storedValue);
    const rawValue = params.get(queryKey);
    if (isNull(rawValue) || isUndefined(rawValue)) {
      return;
    }

    if (field.type === AdvancedSearchFieldType.ARRAY) {
      const values = rawValue.split(",")
        .map(value => value.trim())
        .filter(value => value.length > 0);
      if (isArray(values) && values.length > 0) {
        if (field.key === "leaderIds") {
          const convertedIds = values.map(label => labelToIdMap.get(label) || label).filter(id => !!id);
          const uniqueIds = Array.from(new Set(convertedIds));
          assignValue(field.key, uniqueIds as AdvancedSearchCriteria[keyof AdvancedSearchCriteria]);
        } else {
          assignValue(field.key, values as AdvancedSearchCriteria[keyof AdvancedSearchCriteria]);
        }
      }
      return;
    }

    if (field.type === AdvancedSearchFieldType.BOOLEAN) {
      const booleanValue = rawValue === "true";
      if (isBoolean(booleanValue)) {
        assignValue(field.key, booleanValue as AdvancedSearchCriteria[keyof AdvancedSearchCriteria]);
      }
      return;
    }

    if (field.type === AdvancedSearchFieldType.STRING) {
      if (rawValue && rawValue.trim().length > 0) {
        assignValue(field.key, rawValue as AdvancedSearchCriteria[keyof AdvancedSearchCriteria]);
      }
      return;
    }

    if (DATE_STORED_VALUES.has(field.storedValue)) {
      const parsedDate = parseDateOrNumber(rawValue);
      if (isNumber(parsedDate)) {
        assignValue(field.key, parsedDate as AdvancedSearchCriteria[keyof AdvancedSearchCriteria]);
      }
      return;
    }
    const parsed = Number(rawValue);
    if (!Number.isNaN(parsed)) {
      assignValue(field.key, parsed as AdvancedSearchCriteria[keyof AdvancedSearchCriteria]);
    }
  });

  return hasAdvancedCriteria(criteria as AdvancedSearchCriteria) ? criteria as AdvancedSearchCriteria : null;
}

export function advancedCriteriaQueryParams(criteria: AdvancedSearchCriteria | null, stringUtils: StringUtilsService, dateUtils: DateUtilsService, leaderOptions: WalkLeaderOption[] = []): Record<string, string | number | null> {
  const params: Record<string, string | number | null> = {};

  const idToLabelMap = new Map<string, string>();
  leaderOptions.forEach(option => {
    const queryValue = option.id;
    if (queryValue) {
      idToLabelMap.set(option.id, queryValue);
    }
    if (option.allIds) {
      option.allIds.forEach(altId => {
        if (!idToLabelMap.has(altId)) {
          idToLabelMap.set(altId, queryValue);
        }
      });
    }
  });

  ADVANCED_SEARCH_CRITERIA_FIELDS.forEach(field => {
    const value = criteria?.[field.key];
    const queryKey = stringUtils.kebabCase(field.storedValue);
    if (field.type === AdvancedSearchFieldType.ARRAY) {
      if (field.key === "leaderIds" && isArray(value) && value.length > 0) {
        const labels = (value as string[]).map(id => idToLabelMap.get(id) || id);
        params[queryKey] = labels.join(",");
      } else {
        params[queryKey] = isArray(value) && value.length > 0 ? (value as string[]).join(",") : null;
      }
    } else if (field.type === AdvancedSearchFieldType.BOOLEAN) {
      params[queryKey] = value ? "true" : null;
    } else if (field.type === AdvancedSearchFieldType.STRING) {
      params[queryKey] = value && String(value).trim().length > 0 ? String(value) : null;
    } else if (DATE_STORED_VALUES.has(field.storedValue) && isNumber(value)) {
      params[queryKey] = dateUtils.isoDateTime(value);
    } else if (isUndefined(value) || value === null || Number.isNaN(value as number)) {
      params[queryKey] = null;
    } else {
      params[queryKey] = value as number;
    }
  });
  return params;
}

export function hasAdvancedCriteria(criteria: AdvancedSearchCriteria | null | undefined): boolean {
  if (!criteria) {
    return false;
  }
  return values(criteria).some(value => {
    if (isArray(value)) {
      return value.length > 0;
    }
    if (isBoolean(value)) {
      return value;
    }
    return value;
  });
}

export function advancedSearchSummary(criteria: AdvancedSearchCriteria | null | undefined, stringUtils: StringUtilsService, dateUtils: DateUtilsService, presetLabel?: string, ascending?: boolean): string {
  if (!criteria || !hasAdvancedCriteria(criteria)) {
    if (ascending === false) {
      return "date descending";
    }
    return "";
  }
  const parts: string[] = [];
  if (criteria.dateFrom || criteria.dateTo) {
    if (presetLabel && !presetLabel.startsWith("All ")) {
      parts.push(presetLabel);
    } else if (!presetLabel) {
      const from = criteria.dateFrom ? dateUtils.asString(criteria.dateFrom, undefined, UIDateFormat.DAY_MONTH_YEAR_ABBREVIATED) : "start";
      const to = criteria.dateTo ? dateUtils.asString(criteria.dateTo, undefined, UIDateFormat.DAY_MONTH_YEAR_ABBREVIATED) : "end";
      parts.push(`${from} to ${to}`);
    }
  }
  if (criteria.groupCodes?.length > 0) {
    parts.push(`${stringUtils.pluraliseWithCount(criteria.groupCodes.length, "group")}`);
  }
  if (criteria.leaderIds?.length > 0) {
    parts.push(`${stringUtils.pluraliseWithCount(criteria.leaderIds.length, "leader")}`);
  }
  if (criteria.daysOfWeek?.length > 0) {
    parts.push(criteria.daysOfWeek.map(day => stringUtils.asTitle(day)).join(", "));
  }
  if (criteria.difficulty?.length > 0) {
    parts.push(criteria.difficulty.map(level => stringUtils.asTitle(level)).join(", "));
  }
  if (criteria.distanceMin || criteria.distanceMax) {
    const min = criteria.distanceMin || 0;
    const max = criteria.distanceMax ? `${criteria.distanceMax}` : "+";
    parts.push(`${min}-${max} miles`);
  }
  if (criteria.proximityRadiusMiles) {
    parts.push(`within ${criteria.proximityRadiusMiles} miles`);
  }
  if (criteria.accessibility?.length > 0) {
    parts.push(criteria.accessibility.map(item => stringUtils.asTitle(item)).join(", "));
  }
  if (criteria.facilities?.length > 0) {
    parts.push(criteria.facilities.map(item => stringUtils.asTitle(item)).join(", "));
  }
  if (criteria.freeOnly) {
    parts.push("free only");
  }
  if (criteria.cancelled) {
    parts.push("cancelled");
  }
  if (criteria.noLocation) {
    parts.push("no location");
  }
  if (ascending === false) {
    parts.push("date descending");
  }
  return parts.join(", ");
}

export function savedCriteriaToAdvancedCriteria(saved: SavedSearchCriteria | undefined | null): AdvancedSearchCriteria | null {
  if (!saved) {
    return null;
  }
  const criteria: AdvancedSearchCriteria = {};
  if (saved.dateRange) {
    const now = DateTime.now().startOf("day");
    if (saved.dateRange.direction === DateDirection.FUTURE) {
      criteria.dateFrom = now.toMillis();
      criteria.dateTo = now.plus(saved.dateRange.duration).toMillis();
    } else {
      criteria.dateFrom = now.minus(saved.dateRange.duration).toMillis();
      criteria.dateTo = now.toMillis();
    }
  }
  if (saved.leaderIds?.length) { criteria.leaderIds = saved.leaderIds; }
  if (saved.groupCodes?.length) { criteria.groupCodes = saved.groupCodes; }
  if (saved.locationMethod) { criteria.locationMethod = saved.locationMethod; }
  if (isNumber(saved.proximityLat)) { criteria.proximityLat = saved.proximityLat; }
  if (isNumber(saved.proximityLng)) { criteria.proximityLng = saved.proximityLng; }
  if (isNumber(saved.proximityRadiusMiles)) { criteria.proximityRadiusMiles = saved.proximityRadiusMiles; }
  if (saved.daysOfWeek?.length) { criteria.daysOfWeek = saved.daysOfWeek; }
  if (saved.difficulty?.length) { criteria.difficulty = saved.difficulty; }
  if (isNumber(saved.distanceMin)) { criteria.distanceMin = saved.distanceMin; }
  if (isNumber(saved.distanceMax)) { criteria.distanceMax = saved.distanceMax; }
  if (saved.accessibility?.length) { criteria.accessibility = saved.accessibility; }
  if (saved.facilities?.length) { criteria.facilities = saved.facilities; }
  if (saved.freeOnly) { criteria.freeOnly = saved.freeOnly; }
  if (saved.cancelled) { criteria.cancelled = saved.cancelled; }
  if (saved.noLocation) { criteria.noLocation = saved.noLocation; }
  return hasAdvancedCriteria(criteria) ? criteria : null;
}

export function advancedCriteriaToSavedCriteria(criteria: AdvancedSearchCriteria | null, dateRange?: { direction: DateDirection; duration: { days?: number; months?: number; years?: number } }, presetLabel?: string): SavedSearchCriteria | null {
  if (!criteria || !hasAdvancedCriteria(criteria)) {
    return dateRange ? { presetLabel, dateRange } : null;
  }
  const saved: SavedSearchCriteria = {};
  if (presetLabel) { saved.presetLabel = presetLabel; }
  if (dateRange) { saved.dateRange = dateRange; }
  if (criteria.leaderIds?.length) { saved.leaderIds = criteria.leaderIds; }
  if (criteria.groupCodes?.length) { saved.groupCodes = criteria.groupCodes; }
  if (criteria.locationMethod) { saved.locationMethod = criteria.locationMethod; }
  if (isNumber(criteria.proximityLat)) { saved.proximityLat = criteria.proximityLat; }
  if (isNumber(criteria.proximityLng)) { saved.proximityLng = criteria.proximityLng; }
  if (isNumber(criteria.proximityRadiusMiles)) { saved.proximityRadiusMiles = criteria.proximityRadiusMiles; }
  if (criteria.daysOfWeek?.length) { saved.daysOfWeek = criteria.daysOfWeek; }
  if (criteria.difficulty?.length) { saved.difficulty = criteria.difficulty; }
  if (isNumber(criteria.distanceMin)) { saved.distanceMin = criteria.distanceMin; }
  if (isNumber(criteria.distanceMax)) { saved.distanceMax = criteria.distanceMax; }
  if (criteria.accessibility?.length) { saved.accessibility = criteria.accessibility; }
  if (criteria.facilities?.length) { saved.facilities = criteria.facilities; }
  if (criteria.freeOnly) { saved.freeOnly = criteria.freeOnly; }
  if (criteria.cancelled) { saved.cancelled = criteria.cancelled; }
  if (criteria.noLocation) { saved.noLocation = criteria.noLocation; }
  return keys(saved).length > 0 ? saved : null;
}
