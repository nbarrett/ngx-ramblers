import { AccessLevelData } from "./member-resource.model";
import { FilterCriteria } from "./api-request.model";

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
