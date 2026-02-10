export enum EmailRoutingMatcherType {
  LITERAL = "literal",
  ALL = "all"
}

export enum EmailRoutingMatcherField {
  TO = "to"
}

export enum EmailRoutingActionType {
  FORWARD = "forward",
  DROP = "drop",
  WORKER = "worker"
}

export enum EmailRouteType {
  DIRECT = "direct",
  CATCH_ALL = "catch-all",
  WORKER = "worker",
  NONE = "none"
}

export enum EmailForwardStatus {
  ACTIVE = "active",
  OUTDATED = "outdated",
  MISSING = "missing",
  CATCH_ALL = "catch-all",
  WORKER = "worker",
  NA = "na"
}

export interface EmailRoutingMatcher {
  type: EmailRoutingMatcherType;
  field?: EmailRoutingMatcherField;
  value?: string;
}

export interface EmailRoutingAction {
  type: EmailRoutingActionType;
  value: string[];
}

export interface EmailRoutingRule {
  id?: string;
  tag?: string;
  name: string;
  enabled: boolean;
  matchers: EmailRoutingMatcher[];
  actions: EmailRoutingAction[];
  priority?: number;
}

export interface EmailRoutingRulesResponse {
  rules: EmailRoutingRule[];
}

export interface DestinationVerificationDetail {
  email: string;
  status: DestinationVerificationStatus;
  destinationAddress?: DestinationAddress;
}

export interface EmailRoutingStatus {
  ruleExists: boolean;
  rule?: EmailRoutingRule;
  roleEmail: string;
  destinationEmail: string;
  catchAllRule?: EmailRoutingRule;
  routeType: EmailRouteType;
  effectiveDestination?: string;
  destinationAddress?: DestinationAddress;
  destinationVerificationStatus?: DestinationVerificationStatus;
  workerScriptName?: string;
  destinationEmails?: string[];
  destinationVerificationStatuses?: DestinationVerificationDetail[];
}

export interface CreateOrUpdateEmailRouteRequest {
  roleEmail: string;
  destinationEmail: string;
  roleName: string;
  enabled: boolean;
  destinationEmails?: string[];
  useWorker?: boolean;
}

export interface DestinationAddress {
  id: string;
  email: string;
  verified: string;
  created: string;
  modified: string;
  tag: string;
}

export enum DestinationVerificationStatus {
  VERIFIED = "verified",
  PENDING = "pending",
  NOT_REGISTERED = "not-registered"
}

export interface NonSensitiveCloudflareConfig {
  configured?: boolean;
  accountId?: string;
  zoneId?: string;
  baseDomain?: string;
}

export interface EmailWorkerScript {
  id: string;
  etag?: string;
  modified_on?: string;
  created_on?: string;
}

export interface CreateOrUpdateWorkerRequest {
  roleType: string;
  roleEmail: string;
  roleName: string;
  recipients: string[];
  enabled: boolean;
}

export interface EmailRoutingLogEntry {
  datetime: string;
  sessionId: string;
  from: string;
  to: string;
  status: string;
  spf: string;
  dkim: string;
  dmarc: string;
  errorDetail: string;
}

export interface WorkerInvocationSummary {
  datetime: string;
  scriptName: string;
  status: string;
  requests: number;
  errors: number;
  subrequests: number;
}

export interface EmailRoutingLogsRequest {
  startDate: string;
  endDate: string;
  recipientEmail?: string;
  limit?: number;
}

export interface WorkerLogsRequest {
  startDate: string;
  endDate: string;
  scriptName?: string;
  limit?: number;
}

export enum EmailRoutingLogTab {
  EMAIL_ROUTING = "email-routing",
  WORKER_INVOCATIONS = "worker-invocations"
}
