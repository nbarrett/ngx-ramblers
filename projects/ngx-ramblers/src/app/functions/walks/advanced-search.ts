import { ParamMap } from "@angular/router";
import { isArray, isBoolean, isNull, isNumber, isUndefined, values } from "es-toolkit/compat";
import { AdvancedSearchCriteria, AdvancedSearchFieldType, ADVANCED_SEARCH_CRITERIA_FIELDS, WalkLeaderOption } from "../../models/search.model";
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
