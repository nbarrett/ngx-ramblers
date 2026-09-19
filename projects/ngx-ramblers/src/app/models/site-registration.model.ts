import { AdminUserConfig, SetupProgress } from "./environment-setup.model";
import { SiteMigrationConfig } from "./migration-config.model";
import { MigratedAlbum } from "./migration-scraping.model";
import { PageContent } from "./content-text.model";
import { RamblersGroupsApiResponse } from "./ramblers-walks-manager";
import { ComposerExternalRecipient } from "./email-composer.model";

export enum RegistrationPlan {
  LITE = "lite",
  FULL = "full"
}

export enum RegistrationState {
  AWAITING_EMAIL = "awaiting-email",
  DRAFT = "draft",
  QUEUED = "queued",
  PROVISIONING = "provisioning",
  IMPORTING = "importing",
  REVIEW = "review",
  APPROVING = "approving",
  COMPLETE = "complete",
  FAILED = "failed",
  BROKEN = "broken"
}

export enum RegistrationStep {
  PLAN = "plan",
  GROUP = "group",
  EMAIL = "email",
  CONTENT = "content",
  REVIEW = "review",
  PROGRESS = "progress"
}

export enum RegistrationPageType {
  TEXT = "text",
  INDEX = "index",
  GALLERY = "gallery",
  CONTACT = "contact",
  WALKS = "walks"
}

export enum RegistrationNavbarTitle {
  HOME = "Home",
  ABOUT_US = "About Us",
  WALKS = "Walks",
  EVENTS = "Events",
  LEADING_A_WALK = "Leading a walk",
  CONTACT_US = "Contact Us",
  PHOTOS = "Photos",
  IN_THE_NEWS = "In the news",
  TESTIMONIALS = "Testimonials",
  MEMBERSHIP = "Membership",
  COMMITTEE = "Committee",
  INFORMATION = "Information",
  ADMIN = "Admin"
}

export enum RegistrationNavbarPath {
  HOME = "home",
  ABOUT_US = "about-us",
  WALKS = "walks",
  EVENTS = "social",
  LEADING_A_WALK = "leading-a-walk",
  CONTACT_US = "contact-us",
  PHOTOS = "photos",
  IN_THE_NEWS = "in-the-news",
  TESTIMONIALS = "testimonials",
  MEMBERSHIP = "membership",
  COMMITTEE = "committee",
  INFORMATION = "information",
  ADMIN = "admin"
}

export enum RegistrationSiteFlavour {
  GENERIC = "generic",
  RAMBLERSWEBS = "ramblerswebs",
  WORDPRESS = "wordpress"
}

export enum RamblersDirectoryLogoKind {
  GROUP_HORIZONTAL = "group-horizontal",
  GROUP_VERTICAL = "group-vertical",
  AREA_HORIZONTAL = "area-horizontal",
  AREA_VERTICAL = "area-vertical"
}

export interface RamblersDirectoryLogo {
  kind: RamblersDirectoryLogoKind;
  displayName: string;
  slug: string;
  awsFileName: string;
  originalFileName: string;
}

export enum RegistrationJobStage {
  STARTING = "starting the build",
  PROVISIONING = "provisioning the review site",
  IMPORTING = "importing pages from the current website",
  OS_MAPS = "setting up the OS Maps key",
  WALKS = "loading the Walks Manager programme",
  REVIEWER = "notifying the reviewer",
  INVITING = "inviting the group"
}

export enum RegistrationMigrationTemplate {
  CHILD_INDEX = "fragments/templates/self-service/child-index",
  CONTACT = "fragments/templates/self-service/contact",
  GALLERY = "fragments/templates/self-service/gallery",
  TEXT_WITH_IMAGES = "fragments/templates/self-service/text-with-images",
  PHOTOS_INDEX = "fragments/templates/self-service/photos-index",
  PHOTOS_YEAR = "fragments/templates/self-service/photos-year"
}

export const REGISTRATION_TEMPLATE_YEAR = "{{year}}";

export interface RegistrationPhotoTemplates {
  index: PageContent;
  year: PageContent;
}

export enum RegistrationEmailType {
  CONFIRMATION = "confirmation",
  INVITATION = "invitation",
  REVIEW = "review"
}

export enum RegistrationAdminTab {
  APPROVED_EMAILS = "Approved emails",
  REGISTRATION_REQUESTS = "Registration requests"
}

export const REGISTRATION_PATH = "register";

export const REGISTRATION_ENQUIRY_SUBJECT = "Registering our group or area";

export const REGISTRATION_ADMIN_HELP_PROMPT = "ask the platform administrator for help";

export enum RegistrationPageAnchor {
  PUBLIC_REGISTRATION = "public-registration"
}

export interface RegistrationPage {
  url: string;
  path: string;
  title: string;
  type: RegistrationPageType;
  selected: boolean;
  parentPath: string | null;
  proposed: boolean;
  sourceTitle?: string;
  suggestedTitle?: string;
  imageUrls?: string[];
}

export interface RegistrationNavigationItem {
  path: string;
  title: string;
}

export interface RegistrationContentLink {
  href: string;
  label: string;
  parentPath: string;
  sourcePageUrl: string;
}

export interface RegistrationMigratedAssets {
  pages: PageContent[];
  albums: MigratedAlbum[];
}

export interface RegistrationCommitteeCandidate {
  role: string;
  name: string;
  email: string;
}

export interface RegistrationDraft {
  plan: RegistrationPlan;
  currentStep: RegistrationStep;
  website: string;
  pages: RegistrationPage[];
  proposedNavigation: RegistrationNavigationItem[];
}

export interface RegistrationSiteHealth {
  advertisedUrl: string;
  advertisedReachable: boolean;
  workingUrl: string | null;
  title: string | null;
  detail: string | null;
  action: string | null;
}

export enum RegistrationHistoryAction {
  STARTED = "started",
  RETURN_LINK_SENT = "return-link-sent",
  EMAIL_CONFIRMED = "email-confirmed",
  SUBMITTED = "submitted",
  PROVISIONED = "provisioned",
  WALKS_LOADED = "walks-loaded",
  IMPORTED = "imported",
  READY_FOR_REVIEW = "ready-for-review",
  APPROVED = "approved",
  INVITED = "invited",
  RUN_AGAIN = "run-again",
  PAGES_FOUND_AGAIN = "pages-found-again",
  STOPPED = "stopped",
  MARKED_BROKEN = "marked-broken",
  FAILED = "failed"
}

export const REGISTRATION_HISTORY_LABELS: Record<RegistrationHistoryAction, string> = {
  [RegistrationHistoryAction.STARTED]: "Registration started",
  [RegistrationHistoryAction.RETURN_LINK_SENT]: "Return link emailed",
  [RegistrationHistoryAction.EMAIL_CONFIRMED]: "Committee email confirmed",
  [RegistrationHistoryAction.SUBMITTED]: "Submitted for building",
  [RegistrationHistoryAction.PROVISIONED]: "Review site created",
  [RegistrationHistoryAction.WALKS_LOADED]: "Walks Manager loaded",
  [RegistrationHistoryAction.IMPORTED]: "Website imported",
  [RegistrationHistoryAction.READY_FOR_REVIEW]: "Ready for review",
  [RegistrationHistoryAction.APPROVED]: "Approved",
  [RegistrationHistoryAction.INVITED]: "Group invited",
  [RegistrationHistoryAction.RUN_AGAIN]: "Run again",
  [RegistrationHistoryAction.PAGES_FOUND_AGAIN]: "Pages found again",
  [RegistrationHistoryAction.STOPPED]: "Stopped",
  [RegistrationHistoryAction.MARKED_BROKEN]: "Marked broken",
  [RegistrationHistoryAction.FAILED]: "Build failed"
};

export const REGISTRATION_SYSTEM_ACTOR = "NGX";

export interface RegistrationHistoryEntry {
  action: RegistrationHistoryAction;
  at: number;
  by: string;
}

export interface RegistrationHistoryRow {
  label: string;
  at: number;
  by: string;
  sincePrevious: number | null;
}

export enum RegistrationStageStatus {
  DONE = "done",
  RUNNING = "running",
  WAITING = "waiting",
  FAILED = "failed",
  PENDING = "pending"
}

export enum RegistrationStageKey {
  EMAIL_CONFIRMED = "email-confirmed",
  SUBMITTED = "submitted",
  SITE_CREATED = "site-created",
  WALKS_LOADED = "walks-loaded",
  PAGES_IMPORTED = "pages-imported",
  READY_FOR_REVIEW = "ready-for-review",
  GROUP_INVITED = "group-invited"
}

export interface RegistrationStageLabels {
  done: string;
  running: string;
  waiting: string;
}

export const REGISTRATION_STAGE_LABELS: Record<RegistrationStageKey, RegistrationStageLabels> = {
  [RegistrationStageKey.EMAIL_CONFIRMED]: {done: "Email confirmed", running: "Confirming the email", waiting: "Waiting for the committee email to be confirmed"},
  [RegistrationStageKey.SUBMITTED]: {done: "Submitted", running: "Submitting", waiting: "Waiting for the group to submit"},
  [RegistrationStageKey.SITE_CREATED]: {done: "Site created", running: "Creating the site", waiting: "Waiting to create the site"},
  [RegistrationStageKey.WALKS_LOADED]: {done: "Walks loaded", running: "Loading walks", waiting: "Waiting to load walks"},
  [RegistrationStageKey.PAGES_IMPORTED]: {done: "Pages imported", running: "Importing pages", waiting: "Waiting to import pages"},
  [RegistrationStageKey.READY_FOR_REVIEW]: {done: "Ready for review", running: "Notifying the reviewer", waiting: "Waiting to notify the reviewer"},
  [RegistrationStageKey.GROUP_INVITED]: {done: "Group invited", running: "Inviting the group", waiting: "Waiting for approval"}
};

export interface RegistrationStage {
  key: RegistrationStageKey;
  label: string;
  status: RegistrationStageStatus;
}

export interface RegistrationBuildSpan {
  from: number;
  to: number;
  finished: boolean;
}

export interface RegistrationDiscoveryProgress {
  message: string;
  pagesRead: number;
  pagesFound: number;
  updatedAt: number;
}

export type RegistrationDiscoveryReport = Omit<RegistrationDiscoveryProgress, "updatedAt">;

export type RegistrationDiscoveryReporter = (progress: RegistrationDiscoveryReport) => Promise<void>;

export interface SiteRegistration extends RegistrationDraft {
  id: string;
  group: RamblersGroupsApiResponse;
  email: string;
  state: RegistrationState;
  verifiedAt: number | null;
  createdAt: number;
  updatedAt: number;
  environmentName: string;
  siteUrl: string | null;
  flavour: RegistrationSiteFlavour;
  progress: SetupProgress[];
  error: string | null;
  siteHealth?: RegistrationSiteHealth;
  discoveryProgress?: RegistrationDiscoveryProgress | null;
  history?: RegistrationHistoryEntry[];
  stages?: RegistrationStage[];
}

export interface StoredSiteRegistration extends SiteRegistration {
  resumeTokenHash: string;
  verificationTokenHash: string;
  verificationExpiresAt: number;
  lastEmailAt: number;
  migrationConfig: SiteMigrationConfig | null;
  provisionedAt: number | null;
  walksLoadedAt: number | null;
  importedAt: number | null;
  reviewedAt: number | null;
  reviewNotifiedAt: number | null;
  invitedAt: number | null;
  leaseUntil: number;
  leaseOwner: string | null;
}

export interface RegistrationEmailApproval {
  areaCode?: string;
  areaName?: string;
  groupCode: string;
  groupName?: string;
  recipients: ComposerExternalRecipient[];
}

export interface RegistrationSettings {
  enabled: boolean;
  committeeEmailValidationEnabled: boolean;
  sourceFidelityValidationEnabled: boolean;
  publicUrl: string;
  senderEmail: string;
  reviewer: AdminUserConfig;
  sourceEnvironmentName: string;
  approvedEmails: RegistrationEmailApproval[];
}

export interface RegistrationStartRequest {
  areaCode: string;
  groupCode: string;
  email: string;
  plan: RegistrationPlan;
}

export interface RegistrationStartResponse {
  message: string;
  resumeToken?: string;
}

export interface RegistrationEmailParameters {
  actionUrl: string;
  groupName: string;
  returnUrl?: string;
  siteUrl?: string;
}

export interface RegistrationStepDefinition {
  key: RegistrationStep;
  label: string;
  hint: string;
}

export const REGISTRATION_STEPS: RegistrationStepDefinition[] = [
  {key: RegistrationStep.PLAN, label: "Choose a site", hint: "Lite or Full"},
  {key: RegistrationStep.GROUP, label: "Your group or area", hint: "Area, then group if registering one"},
  {key: RegistrationStep.EMAIL, label: "Confirm email", hint: "Prove committee access"},
  {key: RegistrationStep.CONTENT, label: "Choose content", hint: "Full sites only"},
  {key: RegistrationStep.REVIEW, label: "Review", hint: "Confirm your request"},
  {key: RegistrationStep.PROGRESS, label: "Progress", hint: "Provisioning and review"}
];

export interface RegistrationWalkCandidate {
  id: string;
  startDateTime: string;
  title: string;
  location: string;
}

export interface RegistrationAlbumWalkLink {
  albumName: string;
  albumTitle: string;
  walk: RegistrationWalkCandidate | null;
  reason: string;
}

export interface RegistrationKeyArea {
  title: string;
  href: string;
  description: string;
  imageSource: string | null;
}
