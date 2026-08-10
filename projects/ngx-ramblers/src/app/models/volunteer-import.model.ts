import { VolunteerAssignmentRequest, VolunteerAssignmentScope, VolunteerParish, VolunteerParishType } from "./volunteer-management.model";
import { CreateExternalRecipientRequest } from "./external-recipient.model";
import { ApiResponse } from "./api-response.model";

export enum VolunteerImportMatchConfidence {
  MATCHED = "matched",
  NEEDS_REVIEW = "needs-review",
  UNMATCHED = "unmatched"
}

export enum VolunteerImportRecordKind {
  PARISH = "parish",
  VOLUNTEER = "volunteer",
  ASSIGNMENT = "assignment",
  COUNCIL_CONTACT = "council-contact"
}

export enum VolunteerImportAction {
  CREATE = "create",
  UPDATE = "update",
  SKIP = "skip",
  IMPORT_UNRESOLVED = "import-unresolved"
}

export interface LegacyVolunteerRecord {
  reference: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  notes?: string;
}

export interface LegacyParishRecord {
  reference: string;
  parishName: string;
  parishCode?: string;
  localAuthorityName?: string;
  localAuthorityCode?: string;
  sectorCode?: string;
  rightsOfWayGroupCode?: string;
  membershipGroupCode?: string;
  parishType?: VolunteerParishType;
  noPublicRightsOfWay?: boolean;
  notes?: string;
}

export interface LegacyAssignmentRecord {
  reference: string;
  parishReference: string;
  volunteerReference: string;
  role: string;
  scope?: VolunteerAssignmentScope;
  scopeReference?: string;
  temporary?: boolean;
  effectiveFrom?: number;
  notes?: string;
}

export interface LegacyCouncilContactRecord {
  reference: string;
  parishReference?: string;
  organisationName?: string;
  contactName?: string;
  roleTitle?: string;
  email?: string;
  telephone?: string;
  postalAddress?: string;
  notes?: string;
}

export interface VolunteerImportPayload {
  groupCode: string;
  volunteers: LegacyVolunteerRecord[];
  parishes: LegacyParishRecord[];
  assignments: LegacyAssignmentRecord[];
  councilContacts: LegacyCouncilContactRecord[];
}

export interface VolunteerImportDecision {
  kind: VolunteerImportRecordKind;
  reference: string;
  description: string;
  action: VolunteerImportAction;
  confidence: VolunteerImportMatchConfidence;
  matchedTo?: string;
  reason?: string;
}

export interface VolunteerImportSummary {
  parishesToCreate: number;
  parishesToUpdate: number;
  parishesNeedingReview: number;
  volunteersMatched: number;
  volunteersNeedingReview: number;
  assignmentsToImport: number;
  assignmentsToImportUnresolved: number;
  assignmentsSkipped: number;
  contactsToImport: number;
  contactsNeedingReview: number;
}

export interface VolunteerImportPlan {
  groupCode: string;
  decisions: VolunteerImportDecision[];
  reviewQueue: VolunteerImportDecision[];
  parishes: VolunteerParish[];
  assignments: VolunteerAssignmentRequest[];
  contacts: CreateExternalRecipientRequest[];
  summary: VolunteerImportSummary;
}

export interface VolunteerImportResult {
  dryRun: boolean;
  summary: VolunteerImportSummary;
  reviewQueue: VolunteerImportDecision[];
  parishesWritten: number;
  assignmentsWritten: number;
  contactsWritten: number;
  errors: string[];
}

export enum VolunteerImportStage {
  CHOOSE_FILES = "choose-files",
  PARSED = "parsed",
  DRY_RUN = "dry-run",
  APPLIED = "applied"
}

export enum VolunteerImportStep {
  CLEAR = "clear",
  UPLOAD = "upload",
  CHECK = "check",
  APPLY = "apply"
}

export interface VolunteerImportStepDefinition {
  key: VolunteerImportStep;
  label: string;
}

export interface VolunteerWorkbookParseStats {
  fileName: string;
  parishes: number;
  assignments: number;
  volunteers: number;
  contacts: number;
  contactsWithEmail: number;
  missingSheets: string[];
}

export interface VolunteerImportUploadResult {
  payload: VolunteerImportPayload;
  parse: VolunteerWorkbookParseStats;
}

export interface VolunteerImportApplyRequest extends VolunteerImportPayload {
  fileNames?: string[];
}

export interface VolunteerImportAudit {
  id?: string;
  groupCode: string;
  fileNames: string[];
  summary: VolunteerImportSummary;
  reviewQueue: VolunteerImportDecision[];
  parishesWritten: number;
  assignmentsWritten: number;
  contactsWritten: number;
  errors: string[];
  createdAt: number;
  createdBy: string;
}

export interface VolunteerExportAudit {
  id?: string;
  groupCode: string;
  reportType: string;
  fileName: string;
  rowCount: number;
  createdAt: number;
  createdBy: string;
}

export interface VolunteerExportAuditRequest {
  groupCode: string;
  reportType: string;
  fileName: string;
  rowCount: number;
}

export interface VolunteerImportApiResponse extends ApiResponse {
  response?: VolunteerImportUploadResult | VolunteerImportResult | VolunteerImportAudit[] | VolunteerExportAudit[] | VolunteerExportAudit;
}
