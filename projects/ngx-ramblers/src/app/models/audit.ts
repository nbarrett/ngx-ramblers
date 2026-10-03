import { Auditable } from "./member.model";

export enum AuditStatus {
    info = "info",
    warning = "warning",
    error = "error",
}

export interface RouteAudit extends Omit<Auditable, "id"> {
  createdByName?: string;
  updatedByName?: string;
}

export interface RouteContributor {
  memberId?: string;
  name?: string;
}
