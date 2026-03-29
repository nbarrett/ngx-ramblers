export interface ParishBBox {
  west: number;
  south: number;
  east: number;
  north: number;
}

export interface ParishFeatureProperties {
  PARNCP24CD: string;
  PARNCP24NM: string;
}

export interface ParishCacheEntry {
  data: GeoJSON.FeatureCollection;
  timestamp: number;
}

export enum ParishStatus {
  ALLOCATED = "allocated",
  VACANT = "vacant"
}

export interface ParishAllocation {
  id?: string;
  groupCode: string;
  parishCode: string;
  parishName: string;
  status: ParishStatus;
  assignee?: string;
  assigneeMemberId?: string;
  notes?: string;
  updatedAt?: number;
  updatedBy?: string;
}

export enum ParishAllocationSortField {
  PARISH_NAME = "parishName",
  PARISH_CODE = "parishCode",
  STATUS = "status",
  ASSIGNEE = "assignee"
}

export interface ParishAllocationApiResponse {
  request: any;
  response?: ParishAllocation | ParishAllocation[];
}
