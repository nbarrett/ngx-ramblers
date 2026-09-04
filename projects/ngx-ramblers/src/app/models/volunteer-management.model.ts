import { ApiResponse, Identifiable } from "./api-response.model";
import { Member } from "./member.model";
import { ExternalRecipient } from "./external-recipient.model";

export enum VolunteerRoleType {
  LOCAL_FOOTPATH_OFFICER = "local-footpath-officer",
  PARISH_FOOTPATH_OBSERVER = "parish-footpath-observer",
  GROUP_COORDINATOR = "group-coordinator"
}

export enum VolunteerAssignmentCoverage {
  PERMANENT = "permanent",
  TEMPORARY = "temporary"
}

export enum VolunteerAssignmentScope {
  PARISH = "parish",
  RIGHTS_OF_WAY_GROUP = "rights-of-way-group",
  SECTOR = "sector"
}

export enum VolunteerAssignmentStatus {
  ACTIVE = "active",
  ENDED = "ended"
}

export enum VolunteerAssignmentIdentityStatus {
  LINKED = "linked",
  UNRESOLVED = "unresolved"
}

export enum VolunteerAssignmentEditorMode {
  ADD = "add",
  EDIT = "edit"
}

export enum VolunteerParishEligibility {
  ACTIVE = "active",
  NO_PUBLIC_RIGHTS_OF_WAY = "no-public-rights-of-way"
}

export enum VolunteerParishType {
  PARISH = "parish",
  NON_PARISHED_AREA = "non-parished-area",
  WARD = "ward"
}

export enum VolunteerCoverageStatus {
  COVERED = "covered",
  VACANT = "vacant"
}

export enum VolunteerImportCoverageStatus {
  ALLOCATED = "allocated",
  VACANT = "vacant"
}

export enum VolunteerAudienceType {
  ALL_ROLE_HOLDERS = "all-role-holders",
  LOCAL_FOOTPATH_OFFICERS = "local-footpath-officers",
  PARISH_FOOTPATH_OBSERVERS = "parish-footpath-observers",
  COMBINED_ROLE_HOLDERS = "combined-role-holders",
  PARISH_FOOTPATH_OBSERVERS_EXCLUDING_OFFICERS = "parish-footpath-observers-excluding-officers",
  GROUP_COORDINATORS = "group-coordinators",
  PARISH_AND_TOWN_COUNCILS = "parish-and-town-councils",
  LOCAL_AUTHORITY_CONTACTS = "local-authority-contacts"
}

export interface VolunteerAudienceCriteria {
  audienceType: VolunteerAudienceType;
  localAuthorityCode?: string | null;
  sectorCode?: string | null;
  rightsOfWayGroupCode?: string | null;
}

export interface VolunteerAudienceRecipient {
  email: string;
  name: string;
}

export interface VolunteerAudienceExclusion {
  reason: string;
  count: number;
  names: string[];
}

export interface VolunteerAudience {
  audienceType: VolunteerAudienceType;
  title: string;
  supporterIds: string[];
  externalRecipients: VolunteerAudienceRecipient[];
  excluded: VolunteerAudienceExclusion[];
}

export enum VolunteerReportType {
  VACANCIES = "vacancies",
  COVER_TYPE = "cover-type",
  PARISH_COVERAGE = "parish-coverage",
  ACTIVE_ROLE_HOLDERS = "active-role-holders",
  COMBINED_ROLE_HOLDERS = "combined-role-holders",
  VOLUNTEERS_WITHOUT_ASSIGNMENTS = "volunteers-without-assignments",
  UNRESOLVED_SUPPORTER_LINKS = "unresolved-supporter-links",
  MISSING_CONTACT_INFORMATION = "missing-contact-information",
  PARISH_CODES_FOR_MAPPING = "parish-codes-for-mapping",
  ASSIGNMENT_DIRECTORY = "assignment-directory"
}

export enum VolunteerDirectoryColumn {
  EMAIL = "email",
  COUNCIL_CONTACT = "council-contact"
}

export interface VolunteerReportColumn {
  key: string;
  label: string;
}

export interface VolunteerReport {
  type: VolunteerReportType;
  title: string;
  description: string;
  columns: VolunteerReportColumn[];
  rows: Record<string, string | number>[];
  groupByKey?: string;
}

export enum VolunteerAssignmentBulkAction {
  REPLACE_SUPPORTER = "replace-supporter",
  MARK_PERMANENT = "mark-permanent",
  MARK_TEMPORARY = "mark-temporary",
  END = "end"
}

export enum VolunteerAssignmentAuditAction {
  CREATED = "created",
  UPDATED = "updated",
  ENDED = "ended",
  SUPPORTER_REPLACED = "supporter-replaced",
  COVERAGE_CHANGED = "coverage-changed"
}

export enum VolunteerWorkspaceView {
  PARISHES = "parishes",
  VOLUNTEERS = "volunteers",
  CONTACTS = "contacts",
  MAP = "map",
  STATISTICS = "statistics",
  REPORTS = "reports",
  EMAIL = "email",
  IMPORT = "import"
}

export enum VolunteerAssignmentStatusFilter {
  ACTIVE = "active",
  ENDED = "ended",
  NONE_ACTIVE = "none-active"
}

export enum VolunteerSupporterSortField {
  DISPLAY_NAME = "displayName",
  ROLES = "roles",
  PARISHES = "parishes",
  ACTIVE_ASSIGNMENT_COUNT = "activeAssignmentCount",
  COVER = "cover",
  STATUS = "statusLabel"
}

export enum VolunteerSupporterTableColumn {
  DISPLAY_NAME = "displayName",
  ROLES = "roles",
  PARISHES = "parishes",
  ACTIVE_ASSIGNMENT_COUNT = "activeAssignmentCount",
  COVER = "cover",
  STATUS = "statusLabel",
  ACTIONS = "actions"
}

export enum VolunteerParishSortField {
  PARISH_NAME = "parishName",
  PARISH_CODE = "parishCode",
  STATUS = "status",
  ASSIGNEE = "assignee",
  AUTHORITY = "authority",
  RIGHTS_OF_WAY_GROUP = "rightsOfWayGroupCode",
  LOCAL_FOOTPATH_OFFICER = "localFootpathOfficer",
  PARISH_FOOTPATH_OBSERVER = "parishFootpathObserver",
  COVERAGE = "coverage"
}

export enum VolunteerParishTableColumn {
  PARISH_NAME = "parishName",
  AUTHORITY = "authority",
  RIGHTS_OF_WAY_GROUP = "rightsOfWayGroupCode",
  LOCAL_FOOTPATH_OFFICER = "localFootpathOfficer",
  PARISH_FOOTPATH_OBSERVER = "parishFootpathObserver",
  COVERAGE = "coverage",
  ACTIONS = "actions"
}

export enum VolunteerSummaryFilter {
  ELIGIBLE_PARISHES = "eligible-parishes",
  LOCAL_FOOTPATH_OFFICER_COVERED = "local-footpath-officer-covered",
  LOCAL_FOOTPATH_OFFICER_VACANT = "local-footpath-officer-vacant",
  PARISH_FOOTPATH_OBSERVER_COVERED = "parish-footpath-observer-covered",
  PARISH_FOOTPATH_OBSERVER_VACANT = "parish-footpath-observer-vacant",
  TEMPORARY_ASSIGNMENTS = "temporary-assignments",
  NEEDS_RECONCILIATION = "needs-reconciliation",
  ACTIVE_SUPPORTERS = "active-supporters"
}

export interface VolunteerParishCoverageRow {
  parishName: string;
  parishCode: string;
  status: VolunteerCoverageStatus;
  assignee: string;
}

export interface VolunteerParishTableRow extends VolunteerParish {
  authority: string;
  localFootpathOfficer: string;
  parishFootpathObserver: string;
  localFootpathOfficerNames: string[];
  parishFootpathObserverNames: string[];
  coverage: string;
  hasVacancy: boolean;
  assignmentCount: number;
}

export interface VolunteerParish extends Identifiable {
  groupCode: string;
  parishCode: string;
  parishName: string;
  membershipGroupCode?: string;
  rightsOfWayGroupCode?: string;
  localAuthorityCode?: string;
  localAuthorityName?: string;
  sectorCode?: string;
  parishType?: VolunteerParishType;
  eligibility: VolunteerParishEligibility;
  notes?: string;
  updatedAt?: number;
  updatedBy?: string;
}

export interface VolunteerAssignment extends Identifiable {
  groupCode: string;
  scope?: VolunteerAssignmentScope;
  parishCode?: string;
  rightsOfWayGroupCode?: string;
  sectorCode?: string;
  supporterId?: string | null;
  unresolvedName?: string | null;
  sourceReference?: string;
  identityStatus: VolunteerAssignmentIdentityStatus;
  roleType: VolunteerRoleType;
  coverage: VolunteerAssignmentCoverage;
  status: VolunteerAssignmentStatus;
  effectiveFrom: number;
  effectiveTo?: number;
  notes?: string;
  createdAt: number;
  createdBy: string;
  updatedAt: number;
  updatedBy: string;
}

export interface VolunteerAssignmentRequest extends Identifiable {
  groupCode: string;
  scope?: VolunteerAssignmentScope;
  parishCode?: string;
  rightsOfWayGroupCode?: string;
  sectorCode?: string;
  supporterId?: string | null;
  unresolvedName?: string | null;
  sourceReference?: string;
  identityStatus: VolunteerAssignmentIdentityStatus;
  roleType: VolunteerRoleType;
  coverage: VolunteerAssignmentCoverage;
  effectiveFrom?: number;
  effectiveTo?: number | null;
  notes?: string;
}

export interface VolunteerAssignmentEditorContext {
  parish: VolunteerParish;
  assignment: VolunteerAssignment | null;
}

export interface EditableAssignmentRow {
  assignment: VolunteerAssignment | null;
  roleType: VolunteerRoleType;
  supporter: Member | null;
  coverage: VolunteerAssignmentCoverage;
  effectiveFrom: number | null;
  effectiveTo: number | null;
  notes: string;
  removed?: boolean;
}

export interface VolunteerAssignmentEditorSave {
  upserts: VolunteerAssignmentRequest[];
  endIds: string[];
}

export interface VolunteerParishFilterCriteria {
  searchText: string;
  roleFilter: VolunteerRoleType | null;
  summaryFilter: VolunteerSummaryFilter | null;
  rightsOfWayGroupCode?: string | null;
}

export interface VolunteerSupporterFilterCriteria {
  searchText: string;
  roleFilter: VolunteerRoleType | null;
  statusFilter: VolunteerAssignmentStatusFilter | null;
  coverageFilter: VolunteerAssignmentCoverage | null;
  rightsOfWayGroupCode?: string | null;
}

export interface VolunteerSupporterIdentity {
  id?: string;
  firstName?: string;
  lastName?: string;
  displayName?: string;
  email?: string;
}

export interface VolunteerSupporterAssignment {
  assignment: VolunteerAssignment;
  assignmentId: string;
  parishName: string;
  localAuthorityName: string;
  rightsOfWayGroupCode: string;
  roleLabel: string;
  coverLabel: string;
}

export interface VolunteerSupporterRow {
  key: string;
  supporterId: string | null;
  displayName: string;
  email: string;
  identityStatus: VolunteerAssignmentIdentityStatus;
  roles: string;
  parishes: string;
  parishCount: number;
  activeAssignmentCount: number;
  endedAssignmentCount: number;
  temporaryAssignmentCount: number;
  permanentAssignmentCount: number;
  cover: string;
  statusLabel: string;
  assignments: VolunteerSupporterAssignment[];
}

export interface VolunteerAssignmentPreviewLine {
  assignmentId: string;
  parishName: string;
  roleLabel: string;
  currentValue: string;
  newValue: string;
}

export interface VolunteerAssignmentBulkRequest {
  groupCode: string;
  assignmentIds: string[];
  action: VolunteerAssignmentBulkAction;
  supporterId?: string;
}

export interface VolunteerAssignmentBulkResponse {
  updated: number;
  assignments: VolunteerAssignment[];
}

export interface VolunteerAssignmentConflict {
  assignmentId: string;
  displayName: string;
  roleLabel: string;
  effectiveFrom: number;
  effectiveTo?: number;
}

export enum VolunteerLetterType {
  APPOINTMENT = "appointment",
  AUTHORITY = "authority"
}

export interface VolunteerAudienceLaunch {
  criteria: VolunteerAudienceCriteria;
  letterType: VolunteerLetterType | null;
}

export interface VolunteerLetterSeed {
  letterType: VolunteerLetterType;
  title: string;
  description: string;
  subject: string;
  introMarkdown: string;
}

export const VOLUNTEER_ROLE_MAX_ASSIGNEES: Partial<Record<VolunteerRoleType, number>> = {
  [VolunteerRoleType.LOCAL_FOOTPATH_OFFICER]: 1,
  [VolunteerRoleType.GROUP_COORDINATOR]: 1
};

export interface VolunteerRoleCapacityWarning {
  limit: number;
  roleLabel: string;
  holderNames: string[];
}

export interface VolunteerAssignmentFieldChange {
  fieldName: string;
  from: string;
  to: string;
}

export interface VolunteerAssignmentAudit extends Identifiable {
  groupCode: string;
  assignmentId: string;
  parishCode: string;
  roleType: VolunteerRoleType;
  action: VolunteerAssignmentAuditAction;
  fieldChanges: VolunteerAssignmentFieldChange[];
  performedAt: number;
  performedBy: string;
}

export interface VolunteerCoverageSummary {
  parishCount: number;
  eligibleParishCount: number;
  activeAssignmentCount: number;
  supporterCount: number;
  localFootpathOfficerVacancies: number;
  parishFootpathObserverVacancies: number;
  temporaryAssignmentCount: number;
}

export enum VolunteerRoleCoverState {
  PERMANENT = "permanent",
  TEMPORARY = "temporary",
  VACANT = "vacant"
}

export interface VolunteerRoleCoverageStat {
  roleType: VolunteerRoleType;
  roleLabel: string;
  eligibleParishes: number;
  permanent: number;
  temporary: number;
  vacant: number;
}

export interface VolunteerRoleHolderStat {
  localFootpathOfficers: number;
  parishFootpathObservers: number;
  bothRoles: number;
  groupCoordinators: number;
  needingReconciliation: number;
}

export interface VolunteerAreaCoverageStat {
  key: string;
  label: string;
  eligibleParishes: number;
  localFootpathOfficerVacancies: number;
  parishFootpathObserverVacancies: number;
  localFootpathOfficerHolders: number;
  parishFootpathObserverHolders: number;
}

export interface VolunteerStatistics {
  totalParishes: number;
  eligibleParishes: number;
  noPublicRightsOfWay: number;
  activeAssignments: number;
  temporaryAssignments: number;
  distinctVolunteers: number;
  coverage: VolunteerRoleCoverageStat[];
  roleHolders: VolunteerRoleHolderStat;
  bySector: VolunteerAreaCoverageStat[];
  byGroup: VolunteerAreaCoverageStat[];
}

export interface VolunteerManagementSnapshot {
  parishes: VolunteerParish[];
  assignments: VolunteerAssignment[];
  summary: VolunteerCoverageSummary;
}

export interface VolunteerMyPersonRef {
  name: string;
  email?: string;
  roleLabel: string;
  coverLabel: string;
}

export interface VolunteerMyCouncilContact {
  organisationName?: string;
  contactName?: string;
  roleTitle?: string;
  email?: string;
  telephone?: string;
  postalAddress?: string;
}

export interface VolunteerMyRole {
  roleLabel: string;
  coverLabel: string;
  effectiveFrom?: number;
  effectiveTo?: number;
}

export interface VolunteerMyParish {
  parishCode: string;
  parishName: string;
  localAuthorityName?: string;
  sectorCode?: string;
  rightsOfWayGroupCode?: string;
  myRoles: VolunteerMyRole[];
  counterparts: VolunteerMyPersonRef[];
  councilContacts: VolunteerMyCouncilContact[];
}

export interface VolunteerMyInformation {
  memberName: string;
  parishCount: number;
  parishes: VolunteerMyParish[];
}

export interface VolunteerMyInformationInput {
  memberId: string;
  memberName: string;
  assignments: VolunteerAssignment[];
  parishes: VolunteerParish[];
  members: VolunteerSupporterIdentity[];
  contacts: ExternalRecipient[];
}

export interface VolunteerMapAssignment {
  id?: string;
  parishCode?: string;
  supporterId?: string;
  unresolvedName?: string | null;
  roleType: VolunteerRoleType;
  coverage: VolunteerAssignmentCoverage;
  status: VolunteerAssignmentStatus;
}

export interface VolunteerMapCoverage {
  parishes: VolunteerParish[];
  assignments: VolunteerMapAssignment[];
}

export interface VolunteerDeleteGroupResponse {
  parishes: number;
  assignments: number;
}

export interface VolunteerManagementApiResponse extends ApiResponse {
  response?: VolunteerParish | VolunteerAssignment | VolunteerManagementSnapshot | VolunteerMapCoverage | VolunteerDeleteGroupResponse | VolunteerAssignmentBulkResponse | VolunteerMyInformation;
}
