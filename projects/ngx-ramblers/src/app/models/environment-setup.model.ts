import { ApiResponse } from "./api-response.model";
import { RamblersGroupsApiResponse } from "./ramblers-walks-manager";
import { AWS_DEFAULTS, CustomDomainEntry, FLYIO_DEFAULTS } from "./environment-config.model";
import { RootFolder } from "./system.model";

export interface EnvironmentSetupRequest {
  ramblersInfo: RamblersInfo;
  environmentBasics: EnvironmentBasics;
  serviceConfigs: ServiceConfigs;
  adminUser: AdminUserConfig;
  options: SetupOptions;
  cloneType?: CloneType | null;
  sourceEnvironmentName?: string | null;
}

export interface RamblersInfo {
  areaCode: string;
  areaName: string;
  groupCode: string;
  groupName: string;
  groupUrl?: string;
  groupData?: RamblersGroupsApiResponse;
  areaData?: RamblersGroupsApiResponse;
}

export interface EnvironmentBasics {
  environmentName: string;
  appName: string;
  memory: string;
  scaleCount: number;
  allowedDomains?: string[];
  organisation?: string;
}

export interface ServiceConfigs {
  aws: AwsConfig;
  mongodb: MongoDbConfig;
  brevo: BrevoConfig;
  googleMaps: GoogleMapsConfig;
  osMaps?: OsMapsConfig;
  recaptcha?: RecaptchaConfig;
  ramblers: RamblersApiConfig;
  flyio?: FlyioConfig;
}

export interface FlyioConfig {
  personalAccessToken: string;
}

export interface AwsConfig {
  bucket: string;
  region: string;
}

export interface AwsCustomerCredentials {
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  region: string;
  iamUserName: string;
  policyArn: string;
}

export interface MongoDbConfig {
  cluster: string;
  username: string;
  password: string;
  database: string;
}

export interface MongoClusterInfo {
  cluster: string;
  username: string;
  password: string;
  databases: string[];
}

export interface BrevoConfig {
  apiKey: string;
}

export interface GoogleMapsConfig {
  apiKey: string;
}

export interface OsMapsConfig {
  apiKey: string;
}

export interface RecaptchaConfig {
  siteKey: string;
  secretKey: string;
}

export interface RamblersApiConfig {
  apiKey: string;
  walksManagerUsername?: string;
  walksManagerPassword?: string;
}

export interface AdminUserConfig {
  firstName: string;
  lastName: string;
  email: string;
}

export interface SetupOptions {
  includeSamplePages: boolean;
  includeNotificationConfigs: boolean;
  authenticateBrevoDomain: boolean;
  skipFlyDeployment: boolean;
  copyStandardAssets: boolean;
  setupSubdomain: boolean;
  copySourceBucket: boolean;
  customDomainHostname: string | null;
}

export enum SetupStepStatus {
  Pending = "pending",
  Running = "running",
  Completed = "completed",
  Failed = "failed",
}

export interface SetupProgress {
  step: string;
  status: SetupStepStatus;
  message?: string;
  timestamp?: number;
}

export interface SetupSession {
  sessionId: string;
  request: EnvironmentSetupRequest;
  progress: SetupProgress[];
  status: SetupStepStatus;
  createdAt: number;
  completedAt?: number;
  error?: string;
  result?: EnvironmentSetupResult;
}

export interface SetupWarning {
  step: string;
  message: string;
}

export interface EnvironmentSetupResult {
  environmentName: string;
  appName: string;
  appUrl: string;
  mongoDbUri: string;
  awsCredentials: AwsCustomerCredentials;
  adminUserCreated: boolean;
  configsJsonUpdated: boolean;
  passwordResetId?: string;
  adminUserName?: string;
  adminEmail?: string;
  warnings?: SetupWarning[];
}

export interface ValidationResult {
  valid: boolean;
  message: string;
  details?: Record<string, unknown>;
}

export interface RamblersAreaLookup {
  areaCode: string;
  apiKey: string;
}

export interface RamblersGroupLookup {
  groupCode: string;
  apiKey: string;
}

export interface GroupsByAreaResponse extends ApiResponse {
  success: boolean;
  groups: RamblersGroupsApiResponse[];
}

export interface GroupDetailsResponse extends ApiResponse {
  success: boolean;
  group: RamblersGroupsApiResponse;
}

export interface SetupStatusResponse extends ApiResponse {
  enabled: boolean;
  platformAdminEnabled: boolean;
  requiresApiKey: boolean;
  awsAdminConfigured: boolean;
  ngxLite: boolean;
  hasLocalSocialEvents: boolean;
}

export enum EstateRebuildCaptureFormat {
  XLSX = "xlsx",
  MARKDOWN = "md",
  HTML = "html"
}

export enum EstateRebuildDownloadChoice {
  ALL = "all",
  XLSX = EstateRebuildCaptureFormat.XLSX,
  MARKDOWN = EstateRebuildCaptureFormat.MARKDOWN,
  HTML = EstateRebuildCaptureFormat.HTML
}

export interface EstateRebuildCaptureSummary {
  generatedAtUtc: string;
  siteCount: number;
  fieldsPerSite: number;
  siteCaptureRows: number;
  platformFieldCount: number;
  formats: EstateRebuildCaptureFormat[];
}

export enum EstateRebuildConfigured {
  PRESENT = "present",
  EMPTY = "empty",
  ERROR = "error"
}

export enum EstateRebuildFieldLayer {
  RUNTIME = "runtime",
  APPLICATION = "application",
  PEOPLE = "people",
  CONSOLE = "console"
}

export enum EstateRebuildSystemScope {
  PER_SITE = "per-site",
  PLATFORM = "platform",
  PER_SITE_AND_PLATFORM = "per-site-and-platform"
}

export enum EstateRebuildAuditSection {
  SYSTEMS = "systems",
  SITES = "sites",
  SITE_FIELDS = "site-fields",
  PLATFORM = "platform"
}

export interface EstateRebuildThirdPartySystem {
  systemId: string;
  name: string;
  function: string;
  informationHeld: string;
  configPaths: string;
  scope: EstateRebuildSystemScope | string;
}

export interface EstateRebuildSiteDirectoryRow {
  environment: string;
  group: string;
  groupCode: string;
  areaCode: string;
  siteHref: string;
  flyAppName: string;
  mongoCluster: string;
  mongoDb: string;
  mongoUsername: string;
  awsBucket: string;
  awsRegion: string;
  customDomains: string;
  mailProvider: string;
  chairmanName: string;
  chairmanEmail: string;
  webmasterName: string;
  webmasterEmail: string;
  siteContactsSummary: string;
  ngxLite: boolean;
  probeStatus: string;
}

export interface EstateRebuildSiteCaptureRow {
  environment: string;
  group: string;
  layer: EstateRebuildFieldLayer | string;
  category: string;
  fieldId: string;
  field: string;
  systemId?: string | null;
  configured: EstateRebuildConfigured | string;
  safeValue: string;
  whereHeld: string;
}

export interface EstateRebuildPlatformCaptureRow {
  category: string;
  fieldId: string;
  field: string;
  configured: EstateRebuildConfigured | string;
  safeValue: string;
  whereHeld: string;
}

export interface EstateRebuildInventory {
  generatedAtUtc: string;
  includeSecrets: boolean;
  siteCount: number;
  fieldsPerSite: number;
  siteCaptureRows: number;
  platformFieldCount: number;
  thirdPartySystems: EstateRebuildThirdPartySystem[];
  sites: EstateRebuildSiteDirectoryRow[];
  siteCapture: EstateRebuildSiteCaptureRow[];
  platformCapture: EstateRebuildPlatformCaptureRow[];
}

export interface ConsoleAccessIdentifierInfo {
  key: string;
  label: string;
  placeholder?: string;
  shared?: boolean;
  sharedHint?: string;
}

export enum ConsoleAccessUrlIconKey {
  OVERVIEW = "overview",
  NETWORK = "network",
  USERS = "users",
  DASHBOARD = "dashboard",
  METRICS = "metrics",
  SECRETS = "secrets",
  ORGANISATION = "organisation",
  CONSOLE = "console",
  BUCKET = "bucket",
  ACCOUNT = "account",
  ZONE = "zone",
  DNS = "dns",
  APIS = "apis",
  CREDENTIALS = "credentials",
  BUSINESS = "business",
  REPOSITORIES = "repositories",
  ACTIONS = "actions",
  HOME = "home"
}

export interface ConsoleAccessUrlInfo {
  label: string;
  urlTemplate: string;
  iconKey?: ConsoleAccessUrlIconKey;
}

export interface ConsoleAccessResolvedUrlInfo {
  label: string;
  url: string;
  iconKey?: ConsoleAccessUrlIconKey | null;
}

export interface ConsoleAccessServiceInfo {
  serviceId: string;
  name: string;
  function: string;
  scope: string;
  sharedCredentials?: boolean;
  identifiers: ConsoleAccessIdentifierInfo[];
  urls: ConsoleAccessUrlInfo[];
  resolvedUrls: ConsoleAccessResolvedUrlInfo[];
}

export enum ConsoleAccessCredentialField {
  LOGIN = "login",
  PASSWORD = "password",
  NOTES = "notes"
}

export interface ConsoleAccessLoginView {
  login?: string;
  password?: string;
  notes?: string;
  identifiers?: Record<string, string>;
}

export interface ConsoleAccessDocument {
  scope: string;
  environment: string | null;
  consoleAccess: Record<string, ConsoleAccessLoginView>;
  services: ConsoleAccessServiceInfo[];
}

export interface ConsoleAccessEnvironmentListItem {
  environment: string;
  hasConsoleAccess: boolean;
}

export interface ConsoleAccessEnvironmentsResponse {
  platformHasConsoleAccess: boolean;
  environments: ConsoleAccessEnvironmentListItem[];
}

export interface ConsoleAccessTableRow {
  rowId: string;
  scope: string;
  environmentLabel: string;
  serviceId: string;
  serviceName: string;
  serviceScope: string;
  function: string;
  identifiers: ConsoleAccessIdentifierInfo[];
  urls: ConsoleAccessUrlInfo[];
}

export interface ConsoleSharedIdentifierGroup {
  serviceId: string;
  serviceName: string;
  function: string;
  identifiers: ConsoleAccessIdentifierInfo[];
  sharedCredentials: boolean;
  urls: ConsoleAccessUrlInfo[];
}


export interface NgxLiteAppliedEnvironment {
  environment: string;
  ngxLite: boolean;
}

export interface NgxLiteSyncResponse {
  applied: NgxLiteAppliedEnvironment[];
  failed: string[];
}

export interface EnvironmentDefaults {
  environment?: string;
  database?: string;
  mongodb: {
    cluster: string;
    username: string;
  };
  aws: {
    region: string;
  };
  googleMaps: {
    apiKey: string;
  };
  osMaps: {
    apiKey: string;
  };
  ramblers: {
    apiKey: string;
  };
  recaptcha: {
    siteKey: string;
    secretKey: string;
  };
}

export interface CreateEnvironmentResponse extends ApiResponse {
  success: boolean;
  result: EnvironmentSetupResult;
}

export interface ValidateRequestResponse extends ApiResponse {
  valid: boolean;
  results: ValidationResult[];
}

export interface ExistingEnvironment {
  name: string;
  appName: string;
  memory: string;
  scaleCount: number;
  organisation?: string;
  hasApiKey: boolean;
  hasPreviousFlyCredentials?: boolean;
  previousOrganisation?: string;
  previousAppName?: string;
  customDomains?: CustomDomainEntry[];
}

export interface CustomDomainResponse {
  success: boolean;
  message: string;
  hostname?: string;
  entry?: CustomDomainEntry;
  logs?: string[];
}

export interface CustomDomainEligibility {
  hostname: string;
  managedByThisAccount: boolean;
  dnsProvider: DnsProvider;
  dnsProviderLabel: string;
  nameservers: string[];
  zoneName: string | null;
  message: string;
}

export interface CustomDomainEligibilityResponse extends ApiResponse {
  success: boolean;
  message?: string;
  eligibility?: CustomDomainEligibility;
}

export interface ApexRedirectResponse {
  success: boolean;
  message: string;
  primaryHostname?: string;
  redirectFrom?: string;
  logs?: string[];
}

export interface ExistingEnvironmentsResponse extends ApiResponse {
  environments: ExistingEnvironment[];
}

export interface ResumeEnvironmentResponse extends ApiResponse {
  success: boolean;
  result?: {
    environmentName: string;
    appName: string;
    appUrl: string;
  };
  message?: string;
}

export enum EnvironmentSetupStepperKey {
  RAMBLERS_SELECTION = "ramblers",
  SERVICES_CONFIG = "services",
  ADMIN_USER = "admin",
  REVIEW = "review",
  PROGRESS = "progress"
}

export interface EnvironmentSetupStepperStep {
  key: EnvironmentSetupStepperKey;
  label: string;
}

export enum EnvironmentSetupStepStatus {
  PENDING = "pending",
  ACTIVE = "active",
  DONE = "done"
}

export interface AwsAdminConfig {
  accessKeyId: string;
  secretAccessKey: string;
  region: string;
}

export interface MongoDbConnectionParams {
  uri: string;
  database: string;
}

export interface SecretsFile {
  path: string;
  secrets: Record<string, string>;
}

export interface MongoDbInfo {
  uri: string;
  cluster: string;
  username: string;
  password: string;
  database: string;
  groupName: string;
}

export interface MongoDbConnectionConfig {
  cluster: string;
  username: string;
  password: string;
  database: string;
}

export interface EnvironmentSummary {
  name: string;
  appName: string;
  memory: string;
  scaleCount: number;
  organisation: string;
  hasApiKey: boolean;
  hasPreviousFlyCredentials?: boolean;
  previousOrganisation?: string;
  previousAppName?: string;
}

export interface FlyDeployConfig {
  name: string;
  appName: string;
  memory: string;
  scaleCount: number;
  organisation: string;
  secrets: Record<string, string>;
  apiKey?: string;
}

export interface DeployResult {
  success: boolean;
  appName: string;
  appUrl: string;
  message?: string;
}

export interface SeedConfig {
  mongoUri: string;
  database: string;
  groupName: string;
  groupShortName?: string;
}

export interface ReseedConfigParams {
  mongoUri: string;
  database: string;
  groupName: string;
  groupCode: string;
  areaCode: string;
  areaName: string;
  ramblersApiKey: string;
}

export interface MongoValidationConfig {
  cluster: string;
  username: string;
  password: string;
  database: string;
}

export interface BucketResult {
  success: boolean;
  bucketName: string;
  region: string;
}

export interface IamUserResult {
  success: boolean;
  userName: string;
  accessKeyId: string;
  secretAccessKey: string;
  policyArn: string;
}

export interface AssetCopyFailure {
  file: string;
  error: string;
}

export interface CopyAssetsCliResult {
  icons: string[];
  logos: string[];
  backgrounds: string[];
  failures: AssetCopyFailure[];
}

export type AssetFolder = RootFolder.icons | RootFolder.logos | RootFolder.backgrounds;

export interface CopiedImage {
  width: number;
  originalFileName: string;
  awsFileName: string;
  padding?: number;
}

export interface AssetToCopy {
  sourceKey: string;
  folder: AssetFolder;
  image: CopiedImage;
}

export interface CopyAssetsResult {
  icons: CopiedImage[];
  logos: CopiedImage[];
  backgrounds: CopiedImage[];
  failures: AssetCopyFailure[];
}

export interface ResumeOptions {
  runDbInit: boolean;
  runFlyDeployment: boolean;
}

export interface EnvironmentResult {
  success: boolean;
  environmentName: string;
  appName: string;
  appUrl: string;
  message?: string;
}

export type ProgressCallback = (progress: SetupProgress) => void;

export interface CopiedAssets {
  icons: CopiedImage[];
  logos: CopiedImage[];
  backgrounds: CopiedImage[];
}

export interface InitialiseDatabaseResult {
  passwordResetId: string;
}

export interface SeedDatabaseParams {
  mongoUri: string;
  database: string;
  groupName: string;
  groupShortName?: string;
}

export interface ReinitDatabaseParams {
  mongoUri: string;
  database: string;
  siteUrl?: string;
  groupName: string;
  groupCode: string;
  areaCode: string;
  areaName: string;
  ramblersApiKey: string;
  googleMapsApiKey?: string;
  osMapsApiKey?: string;
}

export interface ReconciliationResult {
  environment: string;
  inDatabase: boolean;
  inConfigsJson: boolean;
  differences: string[];
  databaseConfig?: DeployEnvironmentConfig;
  localConfig?: DeployEnvironmentConfig;
}

export interface ReconciliationReport {
  localCount: number;
  databaseCount: number;
  results: ReconciliationResult[];
  matching: number;
  differing: number;
  missingFromLocal: number;
  missingFromDatabase: number;
}

export interface DeployEnvironmentConfig {
  name: string;
  apiKey: string;
  appName: string;
  memory: string;
  scaleCount: number;
  organisation: string;
}

export enum SetupStep {
  VALIDATE_INPUTS = "validate-inputs",
  QUERY_RAMBLERS_API = "query-ramblers-api",
  CREATE_AWS_RESOURCES = "create-aws-resources",
  COPY_STANDARD_ASSETS = "copy-standard-assets",
  GENERATE_SECRETS = "generate-secrets",
  CREATE_FLY_APP = "create-fly-app",
  WRITE_SECRETS_FILE = "write-secrets-file",
  UPDATE_CONFIGS_JSON = "update-configs-json",
  UPDATE_ENVIRONMENTS_CONFIG = "update-environments-config",
  INITIALISE_DATABASE = "initialise-database",
  CLONE_SOURCE_DATABASE = "clone-source-database",
  ISOLATE_SANDBOX = "isolate-sandbox",
  AUTHENTICATE_BREVO_DOMAIN = "authenticate-brevo-domain",
  IMPORT_SECRETS = "import-secrets",
  DEPLOY_APP = "deploy-app",
  SETUP_SUBDOMAIN = "setup-subdomain"
}

export enum OperationInProgress {
  NONE = "none",
  CREATING = "creating",
  DESTROYING = "destroying",
  VALIDATING = "validating",
  MIGRATING_FLY_ORG = "migrating-fly-org"
}

export enum SetupMode {
  CREATE = "create",
  CLONE = "clone",
  MANAGE = "manage"
}

export enum CloneType {
  SAME_GROUP = "same-group",
  DIFFERENT_GROUP = "different-group",
  FULL_DUPLICATE = "full-duplicate"
}

export enum SandboxHostnameMode {
  GROUP_DOMAIN = "group-domain",
  STAGING_PREFIX = "staging-prefix",
  CUSTOM_NAME = "custom-name"
}

export enum ManageAction {
  MODIFY = "modify",
  MIGRATE_FLY_ORG = "migrate-fly-org",
  DESTROY = "destroy"
}

export enum FlyOrgMigrationPhase {
  NOT_STARTED = "not-started",
  CUTOVER_LIVE = "cutover-live",
  RENAME_IN_PROGRESS = "rename-in-progress",
  PARTIAL = "partial",
  COMPLETE = "complete"
}

export interface FlyOrgMigrationStatus {
  environmentName: string;
  phase: FlyOrgMigrationPhase;
  preferredAppName: string;
  cutoverAppName: string;
  previousAppName: string;
  previousOrganisation: string;
  newOrganisation: string;
  preferredExistsUnderNew: boolean;
  preferredDeployedUnderNew: boolean;
  cutoverExistsUnderNew: boolean;
  cutoverDeployedUnderNew: boolean;
  sourceExistsUnderOld: boolean;
  configAppName: string;
  configPointsAtPreferred: boolean;
  configPointsAtCutover: boolean;
  hasPreviousCredentials: boolean;
  needsPreferredApp: boolean;
  needsPreferredDeploy: boolean;
  needsCutoverCleanup: boolean;
  needsSourceDestroy: boolean;
  needsSubdomainOnPreferred: boolean;
  needsConfigFinalise: boolean;
  customDomainHostnames: string[];
  needsCustomDomainReattach: boolean;
  resumeAvailable: boolean;
  summary: string;
}

export interface EnvironmentStatus {
  databaseInitialised: boolean;
  samplePagesPresent: boolean;
  notificationConfigsPresent: boolean;
  flyAppDeployed: boolean;
  standardAssetsPresent: boolean;
  subdomainConfigured: boolean;
  brevoDomainAuthenticated: boolean;
  hostnameProblemCount: number;
}

export enum HostnameHealth {
  SERVING = "serving",
  REDIRECTING = "redirecting",
  NO_DNS = "no-dns",
  REDIRECT_TARGET_MISSING = "redirect-target-missing",
  UNREACHABLE = "unreachable",
  ZONE_NOT_FOUND = "zone-not-found",
  UNKNOWN = "unknown"
}

export enum HostnameOrigin {
  SITE_URL = "site-url",
  CUSTOM_DOMAIN = "custom-domain",
  SIBLING = "sibling",
  ENVIRONMENT_SUBDOMAIN = "environment-subdomain",
  REDIRECT_TARGET = "redirect-target"
}

export enum DnsProvider {
  CLOUDFLARE = "cloudflare",
  STACK_DNS = "stack-dns",
  OTHER = "other",
  UNKNOWN = "unknown"
}

export const dnsProviderLabels: Record<DnsProvider, string> = {
  [DnsProvider.CLOUDFLARE]: "Cloudflare",
  [DnsProvider.STACK_DNS]: "StackDNS",
  [DnsProvider.OTHER]: "Other",
  [DnsProvider.UNKNOWN]: "Unknown"
};

export interface HostnameStatus {
  hostname: string;
  origin: HostnameOrigin;
  health: HostnameHealth;
  healthy: boolean;
  dnsRecordType: string;
  dnsContent: string;
  proxied: boolean;
  redirectRuleTarget: string;
  httpStatus: number;
  httpRedirectLocation: string;
  nameservers: string[];
  dnsProvider: DnsProvider;
  dnsProviderLabel: string;
  message: string;
}

export interface HostnameHealthReport {
  environmentName: string;
  siteUrl: string;
  relatedGroupSiteUrl: string;
  hostnames: HostnameStatus[];
  problemCount: number;
  checkedAt: number;
}

export interface CrossEnvironmentHostnameHealth {
  environments: HostnameHealthReport[];
  totalProblemCount: number;
  checkedAt: number;
  fromCache: boolean;
}

export const hostnameHealthLabels: Record<HostnameHealth, string> = {
  [HostnameHealth.SERVING]: "Serving",
  [HostnameHealth.REDIRECTING]: "Redirecting",
  [HostnameHealth.NO_DNS]: "No DNS record",
  [HostnameHealth.REDIRECT_TARGET_MISSING]: "Redirect missing",
  [HostnameHealth.UNREACHABLE]: "Unreachable",
  [HostnameHealth.ZONE_NOT_FOUND]: "No Cloudflare zone",
  [HostnameHealth.UNKNOWN]: "Unknown"
};

export const hostnameOriginLabels: Record<HostnameOrigin, string> = {
  [HostnameOrigin.SITE_URL]: "Site URL",
  [HostnameOrigin.CUSTOM_DOMAIN]: "Custom domain",
  [HostnameOrigin.SIBLING]: "apex/www variant",
  [HostnameOrigin.ENVIRONMENT_SUBDOMAIN]: "Environment subdomain",
  [HostnameOrigin.REDIRECT_TARGET]: "Redirect target"
};

export enum EnvironmentSetupTab {
  CREATE = "Create or Modify",
  SETTINGS = "Settings"
}

export function createEmptySetupRequest(): EnvironmentSetupRequest {
  return {
    ramblersInfo: {
      areaCode: "",
      areaName: "",
      groupCode: "",
      groupName: ""
    },
    environmentBasics: {
      environmentName: "",
      appName: "",
      memory: FLYIO_DEFAULTS.MEMORY,
      scaleCount: FLYIO_DEFAULTS.SCALE_COUNT,
      organisation: FLYIO_DEFAULTS.ORGANISATION
    },
    serviceConfigs: {
      aws: { bucket: "", region: AWS_DEFAULTS.REGION },
      mongodb: { cluster: "", username: "", password: "", database: "" },
      brevo: { apiKey: "" },
      googleMaps: { apiKey: "" },
      ramblers: { apiKey: "" },
      flyio: { personalAccessToken: "" }
    },
    adminUser: {
      firstName: "",
      lastName: "",
      email: ""
    },
    options: {
      includeSamplePages: true,
      includeNotificationConfigs: true,
      authenticateBrevoDomain: false,
      skipFlyDeployment: false,
      copyStandardAssets: true,
      setupSubdomain: false,
      copySourceBucket: false,
      customDomainHostname: null
    },
    cloneType: null,
    sourceEnvironmentName: null
  };
}

export function isFullDuplicate(request: EnvironmentSetupRequest): boolean {
  return request.cloneType === CloneType.FULL_DUPLICATE;
}

export const ENVIRONMENT_SUBDOMAIN_BASE = "ngx-ramblers.org.uk";

export function defaultFullDuplicateEnvironmentName(sourceEnvironmentName: string): string {
  return `staging.${sourceEnvironmentName}`;
}

export function environmentSubdomainHostname(environmentName: string, baseDomain = ENVIRONMENT_SUBDOMAIN_BASE): string {
  return `${environmentName}.${baseDomain}`;
}

export function flySafeResourceName(environmentName: string): string {
  return (environmentName || "").toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "");
}
