import { AccessLevelData } from "./member-resource.model";
import { DateCriteria } from "./api-request.model";

export interface HasQuickSearch {
  quickSearch: string;
}

export interface AccessFilterParameters extends HasQuickSearch {
  filter?: AccessLevelData;
}

export interface HasBasicEventSelection {
  selectType: number;
  ascending: boolean;
}

export interface FilterParameters extends HasQuickSearch, HasBasicEventSelection {
}

export function DEFAULT_FILTER_PARAMETERS(): FilterParameters {
  return {quickSearch: "", selectType: 1, ascending: true};
}

export function DEFAULT_BASIC_EVENT_SELECTION(): HasBasicEventSelection {
  return {selectType: 1, ascending: true};
}

export interface DateFilterParameters extends HasQuickSearch {
  selectType: DateCriteria;
  fieldSort: number;
}
