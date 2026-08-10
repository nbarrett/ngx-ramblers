import { HttpClient, HttpParams } from "@angular/common/http";
import { inject, Injectable } from "@angular/core";
import { map, Observable } from "rxjs";
import { VolunteerAssignment, VolunteerAssignmentBulkRequest, VolunteerAssignmentBulkResponse, VolunteerAssignmentRequest, VolunteerDeleteGroupResponse, VolunteerManagementApiResponse, VolunteerManagementSnapshot, VolunteerMapCoverage, VolunteerMyInformation, VolunteerParish } from "../models/volunteer-management.model";
import {
  VolunteerExportAudit,
  VolunteerExportAuditRequest,
  VolunteerImportApiResponse,
  VolunteerImportApplyRequest,
  VolunteerImportAudit,
  VolunteerImportPayload,
  VolunteerImportResult,
  VolunteerImportUploadResult
} from "../models/volunteer-import.model";

@Injectable({providedIn: "root"})
export class VolunteerManagementService {
  private http = inject(HttpClient);
  private baseUrl = "/api/database/volunteer-management";

  snapshot(groupCode: string): Observable<VolunteerManagementSnapshot> {
    const params = new HttpParams().set("groupCode", groupCode);
    return this.http.get<VolunteerManagementApiResponse>(`${this.baseUrl}/snapshot`, {params})
      .pipe(map(apiResponse => apiResponse.response as VolunteerManagementSnapshot));
  }

  coverage(groupCode: string): Observable<VolunteerMapCoverage> {
    const params = new HttpParams().set("groupCode", groupCode);
    return this.http.get<VolunteerManagementApiResponse>(`${this.baseUrl}/coverage`, {params})
      .pipe(map(apiResponse => apiResponse.response as VolunteerMapCoverage));
  }

  myInformation(groupCode: string): Observable<VolunteerMyInformation> {
    const params = new HttpParams().set("groupCode", groupCode);
    return this.http.get<VolunteerManagementApiResponse>(`${this.baseUrl}/my-information`, {params})
      .pipe(map(apiResponse => apiResponse.response as VolunteerMyInformation));
  }

  saveParish(parish: VolunteerParish): Observable<VolunteerParish> {
    return this.http.put<VolunteerManagementApiResponse>(`${this.baseUrl}/parishes`, parish)
      .pipe(map(apiResponse => apiResponse.response as VolunteerParish));
  }

  createAssignment(assignment: VolunteerAssignmentRequest): Observable<VolunteerAssignment> {
    return this.http.post<VolunteerManagementApiResponse>(`${this.baseUrl}/assignments`, assignment)
      .pipe(map(apiResponse => apiResponse.response as VolunteerAssignment));
  }

  updateAssignment(assignment: VolunteerAssignmentRequest): Observable<VolunteerAssignment> {
    return this.http.put<VolunteerManagementApiResponse>(`${this.baseUrl}/assignments/${assignment.id}`, assignment)
      .pipe(map(apiResponse => apiResponse.response as VolunteerAssignment));
  }

  endAssignment(assignmentId: string): Observable<VolunteerAssignment> {
    return this.http.post<VolunteerManagementApiResponse>(`${this.baseUrl}/assignments/${assignmentId}/end`, {})
      .pipe(map(apiResponse => apiResponse.response as VolunteerAssignment));
  }

  bulkUpdateAssignments(request: VolunteerAssignmentBulkRequest): Observable<VolunteerAssignmentBulkResponse> {
    return this.http.post<VolunteerManagementApiResponse>(`${this.baseUrl}/assignments/bulk`, request)
      .pipe(map(apiResponse => apiResponse.response as VolunteerAssignmentBulkResponse));
  }

  deleteGroupData(groupCode: string): Observable<VolunteerDeleteGroupResponse> {
    return this.http.post<VolunteerManagementApiResponse>(`${this.baseUrl}/delete-group-data`, {groupCode})
      .pipe(map(apiResponse => apiResponse.response as VolunteerDeleteGroupResponse));
  }

  uploadImportFiles(formData: FormData): Observable<VolunteerImportUploadResult> {
    return this.http.post<VolunteerImportApiResponse>(`${this.baseUrl}/import/upload`, formData)
      .pipe(map(apiResponse => apiResponse.response as VolunteerImportUploadResult));
  }

  dryRunImport(payload: VolunteerImportPayload): Observable<VolunteerImportResult> {
    return this.http.post<VolunteerImportApiResponse>(`${this.baseUrl}/import/dry-run`, payload)
      .pipe(map(apiResponse => apiResponse.response as VolunteerImportResult));
  }

  applyImport(request: VolunteerImportApplyRequest): Observable<VolunteerImportResult> {
    return this.http.post<VolunteerImportApiResponse>(`${this.baseUrl}/import/apply`, request)
      .pipe(map(apiResponse => apiResponse.response as VolunteerImportResult));
  }

  importAudits(groupCode: string): Observable<VolunteerImportAudit[]> {
    const params = new HttpParams().set("groupCode", groupCode);
    return this.http.get<VolunteerImportApiResponse>(`${this.baseUrl}/import/audits`, {params})
      .pipe(map(apiResponse => apiResponse.response as VolunteerImportAudit[]));
  }

  exportAudits(groupCode: string): Observable<VolunteerExportAudit[]> {
    const params = new HttpParams().set("groupCode", groupCode);
    return this.http.get<VolunteerImportApiResponse>(`${this.baseUrl}/export/audits`, {params})
      .pipe(map(apiResponse => apiResponse.response as VolunteerExportAudit[]));
  }

  recordExportAudit(request: VolunteerExportAuditRequest): Observable<VolunteerExportAudit> {
    return this.http.post<VolunteerImportApiResponse>(`${this.baseUrl}/export/audit`, request)
      .pipe(map(apiResponse => apiResponse.response as VolunteerExportAudit));
  }
}
