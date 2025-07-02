import { Media, RamblersEventType } from "./ramblers-walks-manager";
import { HasMaxColumns } from "./content-text.model";
import { FilterCriteria, SortOrder } from "./api-request.model";

export interface HasMedia {
  media?: Media[];
}

export interface SocialEventsPermissions {
  admin?: boolean;
  detailView?: boolean;
  summaryView?: boolean;
  delete?: boolean;
  edits?: boolean;
  copy?: boolean;
  contentEdits?: boolean;
}

export interface EventsDataAllows {
  autoTitle?: boolean;
  quickSearch?: boolean,
  pagination?: boolean,
  addNew?: boolean
  alert?: boolean
}

export interface EventsData extends HasMaxColumns {
  fromDate: number;
  toDate: number;
  filterCriteria: FilterCriteria;
  sortOrder: SortOrder;
  allow: EventsDataAllows;
  eventTypes: RamblersEventType[];
}
