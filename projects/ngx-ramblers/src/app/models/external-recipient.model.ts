export enum ExternalContactType {
  PARISH_COUNCIL = "parish-council",
  TOWN_COUNCIL = "town-council",
  LOCAL_AUTHORITY = "local-authority",
  OTHER_ORGANISATION = "other-organisation",
  INDIVIDUAL = "individual"
}

export enum ExternalContactSortField {
  DISPLAY_NAME = "displayName",
  ORGANISATION_NAME = "organisationName",
  CONTACT_NAME = "contactName",
  CONTACT_TYPE_LABEL = "contactTypeLabel",
  EMAIL = "email",
  LINKED_PARISH_COUNT = "linkedParishCount"
}

export enum ExternalContactTableColumn {
  DISPLAY_NAME = "displayName",
  CONTACT_TYPE_LABEL = "contactTypeLabel",
  EMAIL = "email",
  TELEPHONE = "telephone",
  LINKED_PARISH_COUNT = "linkedParishCount",
  ACTIONS = "actions"
}

export interface ExternalRecipient {
  id?: string;
  email: string;
  name?: string;
  organisationName?: string;
  contactName?: string;
  roleTitle?: string;
  telephone?: string;
  postalAddress?: string;
  contactType?: ExternalContactType;
  parishCodes?: string[];
  localAuthorityCodes?: string[];
  sectorCodes?: string[];
  rightsOfWayGroupCodes?: string[];
  supporterId?: string | null;
  notes?: string;
  createdBy: string;
  createdAt: number;
  updatedAt?: number;
  updatedBy?: string;
  lastUsedAt?: number;
  lastUsedBy?: string;
}

export interface CreateExternalRecipientRequest {
  email: string;
  name?: string;
  organisationName?: string;
  contactName?: string;
  roleTitle?: string;
  telephone?: string;
  postalAddress?: string;
  contactType?: ExternalContactType;
  parishCodes?: string[];
  localAuthorityCodes?: string[];
  sectorCodes?: string[];
  rightsOfWayGroupCodes?: string[];
  supporterId?: string | null;
  notes?: string;
}

export interface ExternalContactRow extends ExternalRecipient {
  displayName: string;
  contactTypeLabel: string;
  linkedParishCount: number;
  linkedParishNames: string;
  supporterName: string;
}

export enum ExternalContactRetentionStatus {
  STALE = "stale",
  LINKED_TO_SUPPORTER = "linked-to-supporter",
  RETAINED = "retained"
}

export interface ExternalContactRetentionReview {
  contact: ExternalRecipient;
  status: ExternalContactRetentionStatus;
  reason: string;
}

export interface ExternalContactDuplicate {
  id: string;
  displayName: string;
  email: string;
  reason: string;
}

export interface ExternalContactFilterCriteria {
  searchText: string;
  contactType: ExternalContactType | null;
  parishCode: string | null;
}
