import { ApiResponse } from "./api-response.model";
import { RamblersGroupsApiResponse } from "./ramblers-walks-manager";

export interface EnvironmentSetupRequest {
  ramblersInfo: RamblersInfo;
  environmentBasics: EnvironmentBasics;
  serviceConfigs: ServiceConfigs;
  adminUser: AdminUserConfig;
  options: SetupOptions;
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
  password: string;
}

export interface SetupOptions {
  includeSamplePages: boolean;
  includeNotificationConfigs: boolean;
  skipFlyDeployment: boolean;
  copyStandardAssets: boolean;
}

export type SetupStepStatus = "pending" | "running" | "completed" | "failed";

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

export interface EnvironmentSetupResult {
  environmentName: string;
  appName: string;
  appUrl: string;
  mongoDbUri: string;
  awsCredentials: AwsCustomerCredentials;
  adminUserCreated: boolean;
  configsJsonUpdated: boolean;
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
  requiresApiKey: boolean;
  awsAdminConfigured: boolean;
}

export interface EnvironmentDefaults {
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

export enum SetupStep {
  VALIDATE_INPUTS = "validate-inputs",
  QUERY_RAMBLERS_API = "query-ramblers-api",
  CREATE_AWS_RESOURCES = "create-aws-resources",
  COPY_STANDARD_ASSETS = "copy-standard-assets",
  GENERATE_SECRETS = "generate-secrets",
  CREATE_FLY_APP = "create-fly-app",
  WRITE_SECRETS_FILE = "write-secrets-file",
  UPDATE_CONFIGS_JSON = "update-configs-json",
  UPDATE_BACKUP_CONFIG = "update-backup-config",
  INITIALISE_DATABASE = "initialise-database",
  IMPORT_SECRETS = "import-secrets",
  DEPLOY_APP = "deploy-app"
}

export enum OperationInProgress {
  NONE = "none",
  CREATING = "creating",
  DESTROYING = "destroying",
  VALIDATING = "validating"
}

export enum SetupMode {
  CREATE = "create",
  MANAGE = "manage"
}

export enum ManageAction {
  RESUME = "resume",
  DESTROY = "destroy"
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
      memory: "1024",
      scaleCount: 1,
      organisation: "personal"
    },
    serviceConfigs: {
      aws: { bucket: "", region: "eu-west-1" },
      mongodb: { cluster: "", username: "", password: "", database: "" },
      brevo: { apiKey: "" },
      googleMaps: { apiKey: "" },
      ramblers: { apiKey: "" },
      flyio: { personalAccessToken: "" }
    },
    adminUser: {
      firstName: "",
      lastName: "",
      email: "",
      password: ""
    },
    options: {
      includeSamplePages: true,
      includeNotificationConfigs: true,
      skipFlyDeployment: false,
      copyStandardAssets: true
    }
  };
}
