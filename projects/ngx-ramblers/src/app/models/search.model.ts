import { AccessLevelData } from "./member-resource.model";
import { FilterCriteria } from "./api-request.model";
import { StoredValue } from "./ui-actions";
import { SortDirection } from "./sort.model";
import { DateTime } from "luxon";

export enum LocationMethod {
  NONE = "none",
  CURRENT_LOCATION = "current-location",
  ENTER_LOCATION = "enter-location"
}

export interface HasQuickSearch {
  quickSearch: string;
}

export interface AccessFilterParameters extends HasQuickSearch {
  filter?: AccessLevelData;
}

export interface HasBasicEventSelection {
  selectType: FilterCriteria;
  ascending: boolean;
}

export interface FilterParameters extends HasQuickSearch, HasBasicEventSelection {
}

export function DEFAULT_FILTER_PARAMETERS(): FilterParameters {
  return {quickSearch: "", selectType: FilterCriteria.FUTURE_EVENTS, ascending: true};
}

export function DEFAULT_BASIC_EVENT_SELECTION(): HasBasicEventSelection {
  return {selectType: FilterCriteria.FUTURE_EVENTS, ascending: true};
}

export interface DateFilterParameters extends HasQuickSearch {
  selectType: FilterCriteria;
  fieldSort: number;
}

export interface GroupEventSearchParams {
  fromDate?: string;
  toDate?: string;
  leaderIds?: string[];
  groupCodes?: string[];
  proximityLat?: number;
  proximityLng?: number;
  proximityRadiusMiles?: number;
  daysOfWeek?: string[];
  difficulty?: string[];
  distanceMin?: number;
  distanceMax?: number;
  accessibility?: string[];
  facilities?: string[];
  freeOnly?: boolean;
  page?: number;
  limit?: number;
  sort?: string;
  sortDirection?: SortDirection;
}

export interface AdvancedSearchCriteria {
  dateFrom?: number;
  dateTo?: number;
  leaderIds?: string[];
  groupCodes?: string[];
  locationMethod?: LocationMethod;
  proximityLat?: number;
  proximityLng?: number;
  proximityRadiusMiles?: number;
  daysOfWeek?: string[];
  difficulty?: string[];
  distanceMin?: number;
  distanceMax?: number;
  accessibility?: string[];
  facilities?: string[];
  freeOnly?: boolean;
  cancelled?: boolean;
  noLocation?: boolean;
}

export enum AdvancedSearchFieldType {
  NUMBER = "number",
  ARRAY = "array",
  BOOLEAN = "boolean",
  STRING = "string"
}

export interface AdvancedSearchCriteriaField {
  key: keyof AdvancedSearchCriteria;
  storedValue: StoredValue;
  type: AdvancedSearchFieldType;
}

export const ADVANCED_SEARCH_CRITERIA_FIELDS: AdvancedSearchCriteriaField[] = [
  { key: "dateFrom", storedValue: StoredValue.DATE_FROM, type: AdvancedSearchFieldType.NUMBER },
  { key: "dateTo", storedValue: StoredValue.DATE_TO, type: AdvancedSearchFieldType.NUMBER },
  { key: "leaderIds", storedValue: StoredValue.LEADERS, type: AdvancedSearchFieldType.ARRAY },
  { key: "groupCodes", storedValue: StoredValue.GROUP_CODES, type: AdvancedSearchFieldType.ARRAY },
  { key: "locationMethod", storedValue: StoredValue.LOCATION_METHOD, type: AdvancedSearchFieldType.STRING },
  { key: "proximityLat", storedValue: StoredValue.PROXIMITY_LAT, type: AdvancedSearchFieldType.NUMBER },
  { key: "proximityLng", storedValue: StoredValue.PROXIMITY_LNG, type: AdvancedSearchFieldType.NUMBER },
  { key: "proximityRadiusMiles", storedValue: StoredValue.PROXIMITY_RADIUS, type: AdvancedSearchFieldType.NUMBER },
  { key: "daysOfWeek", storedValue: StoredValue.DAYS_OF_WEEK, type: AdvancedSearchFieldType.ARRAY },
  { key: "difficulty", storedValue: StoredValue.DIFFICULTY, type: AdvancedSearchFieldType.ARRAY },
  { key: "distanceMin", storedValue: StoredValue.DISTANCE_MIN, type: AdvancedSearchFieldType.NUMBER },
  { key: "distanceMax", storedValue: StoredValue.DISTANCE_MAX, type: AdvancedSearchFieldType.NUMBER },
  { key: "accessibility", storedValue: StoredValue.ACCESSIBILITY, type: AdvancedSearchFieldType.ARRAY },
  { key: "facilities", storedValue: StoredValue.FACILITIES, type: AdvancedSearchFieldType.ARRAY },
  { key: "freeOnly", storedValue: StoredValue.FREE_ONLY, type: AdvancedSearchFieldType.BOOLEAN },
  { key: "cancelled", storedValue: StoredValue.CANCELLED, type: AdvancedSearchFieldType.BOOLEAN },
  { key: "noLocation", storedValue: StoredValue.NO_LOCATION, type: AdvancedSearchFieldType.BOOLEAN }
];

export interface SearchDateRange {
  from: number;
  to: number;
}

export enum DistanceUnit {
  MILES = "miles",
  KILOMETERS = "kilometers"
}

export enum DateRangeUnit {
  DAYS = "days",
  WEEKS = "weeks",
  MONTHS = "months",
  YEARS = "years"
}

export enum DateRangeDirection {
  FUTURE = "future",
  PAST = "past"
}

export const RANGE_UNIT_OPTIONS: { value: DateRangeUnit; label: string }[] = [
  { value: DateRangeUnit.DAYS, label: "Days" },
  { value: DateRangeUnit.WEEKS, label: "Weeks" },
  { value: DateRangeUnit.MONTHS, label: "Months" },
  { value: DateRangeUnit.YEARS, label: "Years" }
];

export const CUSTOM_PRESET_LABEL = "custom-range";
export const PRESET_MATCH_THRESHOLD_MS = 3 * 24 * 60 * 60 * 1000;

export interface DistanceRange {
  min: number;
  max: number;
  unit?: DistanceUnit;
}

export interface AdvancedSearchPreset {
  label: string;
  range: () => SearchDateRange;
}

export interface WalkLeaderOption {
  id: string;
  label: string;
  allIds?: string[];
  allLabels?: string[];
}

export interface GroupEventSearchResponse {
  groupEvents: any[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    pages: number;
  };
}

export interface SyncStatusResponse {
  lastSyncedAt?: string;
}

export function createFuturePreset(label: string, duration: { days?: number; months?: number; years?: number }): AdvancedSearchPreset {
  return {
    label,
    range: () => {
      const start = DateTime.now().startOf("day");
      return {
        from: start.toMillis(),
        to: start.plus(duration).toMillis()
      };
    }
  };
}

export function createPastPreset(label: string, duration: { days?: number; months?: number; years?: number }): AdvancedSearchPreset {
  return {
    label,
    range: () => {
      const now = DateTime.now().startOf("day");
      return {
        from: now.minus(duration).toMillis(),
        to: now.toMillis()
      };
    }
  };
}

export function createAllTimePreset(label: string, minDate: DateTime, maxDate: DateTime): AdvancedSearchPreset {
  return {
    label,
    range: () => ({
      from: minDate.toMillis(),
      to: maxDate.toMillis()
    })
  };
}

export function createFuturePresetRanges(minDate: DateTime, maxDate: DateTime): AdvancedSearchPreset[] {
  return [
    createFuturePreset("Next 7 Days", { days: 7 }),
    createFuturePreset("Next 30 Days", { days: 30 }),
    createFuturePreset("Next 3 Months", { months: 3 }),
    createFuturePreset("Next 6 Months", { months: 6 }),
    createAllTimePreset("All Walks Today Onwards", minDate, maxDate)
  ];
}

export function createPastPresetRanges(minDate: DateTime, maxDate: DateTime): AdvancedSearchPreset[] {
  return [
    createPastPreset("Past 7 Days", { days: 7 }),
    createPastPreset("Past 30 Days", { days: 30 }),
    createPastPreset("Past 3 Months", { months: 3 }),
    createPastPreset("Past 6 Months", { months: 6 }),
    createPastPreset("Past Year", { years: 1 }),
    createPastPreset("Past 2 Years", { years: 2 }),
    createAllTimePreset("All Past Walks", minDate, maxDate)
  ];
}

export function createAllWalksPresetRanges(minDate: DateTime, maxDate: DateTime): AdvancedSearchPreset[] {
  return [
    createPastPreset("Past 30 Days", { days: 30 }),
    createPastPreset("Past Year", { years: 1 }),
    createFuturePreset("Next 30 Days", { days: 30 }),
    createFuturePreset("Next 6 Months", { months: 6 }),
    createAllTimePreset("All Walks", minDate, maxDate)
  ];
}
