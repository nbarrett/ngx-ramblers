import { AdminUserConfig, SetupProgress } from "./environment-setup.model";
import { SiteMigrationConfig } from "./migration-config.model";
import { RamblersGroupsApiResponse } from "./ramblers-walks-manager";

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

export enum RegistrationMigrationTemplate {
  CHILD_INDEX = "fragments/templates/self-service/child-index",
  CONTACT = "fragments/templates/self-service/contact",
  GALLERY = "fragments/templates/self-service/gallery",
  TEXT_WITH_IMAGES = "fragments/templates/self-service/text-with-images"
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
  groupCode: string;
  emails: string[];
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
  {key: RegistrationStep.GROUP, label: "Your group", hint: "Area and group"},
  {key: RegistrationStep.EMAIL, label: "Confirm email", hint: "Prove committee access"},
  {key: RegistrationStep.CONTENT, label: "Choose content", hint: "Full sites only"},
  {key: RegistrationStep.REVIEW, label: "Review", hint: "Confirm your request"},
  {key: RegistrationStep.PROGRESS, label: "Progress", hint: "Provisioning and review"}
];
