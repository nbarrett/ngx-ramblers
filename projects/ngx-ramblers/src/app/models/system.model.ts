import { Link } from "./page.model";
import { HasClass, HasColour } from "./banner-configuration.model";
import { GoogleMapsConfig, WalkListView } from "./walk.model";
import { HasStyles } from "./content-text.model";
import { ImageCropperPosition } from "./image-cropper.model";

export { GoogleMapsConfig };

export enum SystemSettingsTab {
  AREA_AND_GROUP = "Area & Group",
  MAPS = "Maps",
  BACKGROUNDS = "Backgrounds",
  ICONS = "Icons",
  LOGOS = "Logos",
  IMAGES = "Images",
  STYLES = "Styles",
  WEBSITE_HEADER = "Header",
  WEBSITE_FOOTER = "Footer",
  EXTERNAL_SYSTEMS = "External Systems",
}

export enum ExternalSystemsSubTab {
  ALL = "all",
  RAMBLERS = "ramblers",
  MAIL = "mail",
  SOCIAL = "social",
  MAPS = "maps",
  CLOUDFLARE = "cloudflare",
  SECURITY = "security"
}

export enum EnvironmentSettingsSubTab {
  ALL = "all",
  GLOBAL = "global",
  ENVIRONMENTS = "environments",
  TOOLS = "tools"
}

export enum ImageMigrationTab {
  SCAN = "Scan Configuration",
  RESULTS = "Scan Results",
  ACTIVITY = "Activity",
  EXTERNAL_IMPORT = "Import from External Sources"
}

export enum EventPopulation {
  LOCAL = "local",
  WALKS_MANAGER = "walks-manager",
}

export enum RamblersSyncMode {
  INCREMENTAL = "incremental",
  FULL = "full"
}

export interface WalksManagerSyncStats {
  added: number;
  updated: number;
  deleted: number;
  errors: string[];
  lastSyncedAt: number;
  totalProcessed: number;
}

export interface WalksManagerSyncStatusResponse {
  lastSyncedAt: number;
}

export enum MailProvider {
  BREVO = "brevo",
  MAILCHIMP = "mailchimp",
  NONE = "none",
}

export interface Group {
  longName?: string;
  groupCode?: string;
}

export interface AreaGroup {
  groupCode: string;
  name: string;
  url?: string;
  externalUrl?: string;
  onsDistricts: string | string[];
  color?: string;
  nonGeographic?: boolean;
}

export interface AvailableArea {
  areaCode: string;
  areaName: string;
}

export interface AvailableAreaWithLabel extends AvailableArea {
  ngSelectLabel: string;
}

export enum SharedDistrictStyle {
  STRIPES = "stripes",
  FIRST_GROUP = "first-group",
  DASHED_BORDER = "dashed-border",
  GRADIENT = "gradient"
}

export interface Organisation extends Group {
  defaultWalkListView: WalkListView;
  walkPopulation: EventPopulation;
  socialEventPopulation: EventPopulation;
  walkContactDetailsPublic: boolean;
  allowSwitchWalkView: boolean;
  socialDetailsPublic: boolean;
  shortName?: string;
  href?: string;
  pages: Link[];
  groups?: AreaGroup[];
  center?: [number, number];
  zoom?: number;
  mapOutlierMaxDistanceMiles?: number;
  neighboringAreaCodes?: string[];
  exclusiveDistricts?: boolean;
  sharedDistrictStyle?: SharedDistrictStyle;
}

export interface Ramblers {
  mainSite: Link;
  walksManager: AuthenticationDetailsWithLink;
}

export interface AuthenticationDetailsWithLink extends Link, AuthenticationDetails {
}

export interface AuthenticationDetails {
  userName: string;
  password: string;
  apiKey: string;
}

export interface Footer {
  quickLinks: Link[];
  legals: Link[];
  pages: Link[];
  appDownloads: {
    google: string | Link;
    apple: string | Link;
  };
}

export interface ExternalSystem {
  groupUrl?: string;
  showFooterLink?: boolean;
  showFeed?: boolean;
}

export interface Instagram extends ExternalSystem {
  groupName?: string;
  accessToken?: string;
  clientId?: string;
  clientSecret?: string;
  userId?: string;
}

export interface Meetup extends ExternalSystem {
  apiUrl?: string;
  groupName?: string;
  clientId?: string;
  clientSecret?: string;
  clientRedirectUrl?: string;
  accessToken?: string;
  refreshToken?: string;
  apiKey?: string;
}

export interface Facebook extends ExternalSystem {
  pagesUrl?: string;
  appId?: string;
}

export interface Flickr extends ExternalSystem {
  apiKey: string;
  userId?: string;
}

export interface ExternalSystems {
  facebook?: Facebook;
  flickr?: Flickr;
  instagram?: Instagram;
  meetup?: Meetup;
  linkedIn?: ExternalSystem;
  osMaps?: { apiKey?: string };
  twitter?: ExternalSystem;
  youtube?: ExternalSystem;
}

export interface SocialMediaLinks extends HasColour {
  show: boolean;
  width: number;
}

export interface RightPanel {
  show: boolean;
  showNavigationButtons: boolean;
  showLoginLinksAndSiteEdit: boolean;
  socialMediaLinks: SocialMediaLinks;
}

export interface HeaderBar {
  show: boolean;
  showNavigationButtons: boolean;
  showLoginLinksAndSiteEdit: boolean;
}

export interface Header {
  navigationButtons: Link[];
  selectedLogo: string;
  navBar?: NavBar;
  headerBar?: HeaderBar;
  rightPanel?: RightPanel;
}

export interface NavBar extends HasClass {
  location: string;
  justification?: NavBarJustification;
}


export interface Image {
  awsFileName?: string;
  originalFileName?: string;
  width: number;
  padding: number;
  cropperPosition?: ImageCropperPosition | null;
}

export enum RootFolder {
  backgrounds = "backgrounds",
  bannerPhotos = "banner-photos",
  carousels = "carousels",
  icons = "icons",
  logos = "logos",
  siteContent = "site-content",
  walkImages = "walk-images",
  walkImports = "walk-imports",
  gpxRoutes = "gpx-routes",
  socialEventsImages = "images-social-events",
  esriRoutes = "esri-routes"
}

export enum BuiltInAlbumName {
  socialEventsImages = "images-social-events"
}

export enum NavBarLocation {
  LOGO_RIGHT = "logo-right",
  BELOW_LOGO = "below-logo",
}

export enum NavBarJustification {
  LEFT = "left",
  CENTER = "center",
  RIGHT = "right",
}

export interface Images {
  rootFolder: RootFolder;
  images: Image[];
}

export const defaultImage: Image = {padding: 0, width: 150, originalFileName: null, awsFileName: null};

export interface SystemConfig {
  globalStyles: HasStyles;
  icons: Images;
  backgrounds: Images
  logos: Images
  header: Header,
  footer: Footer
  group: Organisation;
  area: Organisation;
  national: Ramblers;
  externalSystems: ExternalSystems
  recaptcha: ReCaptchaConfig
  googleMaps: GoogleMapsConfig
  enableMigration: { events: boolean }
  images: ImageConfig
  googleAnalytics: GoogleAnalyticsConfig
  mailDefaults: {
    mailProvider: MailProvider;
    autoSubscribeNewMembers: boolean;
  }
  activeChangelogCollection?: string;
}

export interface GoogleAnalyticsConfig {
  trackingId: string;
}


export interface ColourSelector {
  class: string;
  badgeClass?: string;
  name: string;
  colour?: string;
}


export const rgbColourCloudy = "rgb(255, 255, 255)";
export const rgbColourGranite = "rgb(64, 65, 65)";
export const rgbColourMintcake = "rgb(155, 200, 171)";
export const rgbColourRosyCheeks = "rgb(246, 176, 157)";
export const rgbColourSunrise = "rgb(249, 177, 4)";
export const rgbColourSunset = "rgb(240, 128, 80)";
export const rgbColourGrey = "rgb(222, 226, 230)";
export const classBackgroundLight = "bg-light";
export const classBackgroundDark = "bg-dark";
export const classColourCloudy = "colour-cloudy";
export const classColourGranite = "colour-granite";
export const colourSelectors: ColourSelector[] = [
  {class: "d-none", name: "Hide"},
  {class: classColourCloudy, badgeClass: "badge badge-cloudy", name: "Cloudy", colour: rgbColourCloudy},
  {class: classColourGranite, badgeClass: "badge badge-granite", name: "Granite", colour: rgbColourGranite},
  {class: "colour-mintcake", badgeClass: "badge badge-mintcake", name: "Mintcake", colour: rgbColourMintcake},
  {class: "colour-rosycheeks", badgeClass: "badge badge-rosycheeks", name: "Rosy Cheeks", colour: rgbColourRosyCheeks},
  {class: "colour-sunrise", badgeClass: "badge badge-sunrise", name: "Sunrise", colour: rgbColourSunrise},
  {class: "colour-sunset", badgeClass: "badge badge-sunset", name: "Sunset", colour: rgbColourSunset},
  {class: "colour-grey", badgeClass: "badge badge-grey", name: "Grey", colour: rgbColourGrey},
];

export const colourSelectorsDarkLight: ColourSelector[] = [
  {class: classBackgroundLight, badgeClass: "badge badge-cloudy", name: "Light", colour: rgbColourCloudy},
  {class: classBackgroundDark, badgeClass: "badge badge-granite", name: "Dark", colour: rgbColourGranite}
];

export const textStyleSelectors: ColourSelector[] = [
  {class: "as-button", badgeClass: "badge badge-as-button", name: "Make Links Buttons"},
  {class: "", name: "Clear"},
  {class: "d-none", name: "Hide"},
  {class: "text-style-cloudy", badgeClass: "badge badge-cloudy", name: "Cloudy", colour: rgbColourCloudy},
  {class: "text-style-granite", badgeClass: "badge badge-granite", name: "Granite", colour: rgbColourGranite},
  {class: "text-style-mintcake", badgeClass: "badge badge-mintcake", name: "Mintcake", colour: rgbColourMintcake},
  {
    class: "text-style-rosycheeks",
    badgeClass: "badge badge-rosycheeks",
    name: "Rosy Cheeks",
    colour: rgbColourRosyCheeks
  },
  {class: "text-style-sunrise", badgeClass: "badge badge-sunrise", name: "Sunrise", colour: rgbColourSunrise},
  {class: "text-style-sunset", badgeClass: "badge badge-sunset", name: "Sunset", colour: rgbColourSunset},
  {class: "text-style-grey", badgeClass: "badge badge-grey", name: "Grey", colour: rgbColourGrey},
];


export interface MailProviderStats {
  hasNoMailSubscription: number;
  validIds: number;
  pendingIds: number;
  hasMailSubscription: number;
  invalidIds: number;
}

export const defaultRamblersConfig: Ramblers = {
  mainSite: {
    href: "https://ramblers.org.uk",
    title: "Ramblers"
  },
  walksManager: {
    href: "https://walks-manager.ramblers.org.uk/walks-manager",
    title: "Walks Manager",
    apiKey: null,
    password: null,
    userName: null
  }
};

export const defaultNavbar: NavBar = {
  class: classBackgroundLight,
  location: NavBarLocation.LOGO_RIGHT,
  justification: NavBarJustification.RIGHT
};

export const defaultHeaderBar: HeaderBar = {
  show: true,
  showLoginLinksAndSiteEdit: true,
  showNavigationButtons: true
};

export const defaultRightPanel: RightPanel = {
  show: false,
  socialMediaLinks: {
    show: false,
    colour: rgbColourSunset,
    width: 100
  },
  showLoginLinksAndSiteEdit: true,
  showNavigationButtons: false
};


export interface ReCaptchaConfig {
  siteKey: string;
  secretKey: string;
}

export interface AlbumGridDefaults {
  columns: number;
  gap: number;
  layoutMode: string;
  showTitles: boolean;
}

export interface ImageConfig {
  imageLists: {
    defaultMaxImageSize: number;
    defaultAspectRatio: string;
  };
  albumGrid?: AlbumGridDefaults;
}

export interface CaptchaVerificationResponse {
  success: boolean;
  challenge_ts: string;
  hostname: string;
  score?: number;
  action?: string;
  "error-codes"?: string[];
}

export enum ImageMigrationStatus {
  PENDING = "pending",
  IN_PROGRESS = "in-progress",
  MIGRATED = "migrated",
  FAILED = "failed",
  SKIPPED = "skipped"
}

export enum ImageMigrationSourceType {
  CONTENT_METADATA = "content-metadata",
  PAGE_CONTENT = "page-content",
  GROUP_EVENT = "group-event",
  SOCIAL_EVENT = "social-event"
}

export interface ExternalImageReference {
  id: string;
  sourceType: ImageMigrationSourceType;
  sourceId: string;
  sourcePath: string;
  sourceTitle: string;
  currentUrl: string;
  thumbnailUrl: string;
  fileSize: number | null;
  status: ImageMigrationStatus;
  selected: boolean;
  newS3Url: string | null;
  errorMessage: string | null;
}

export interface ImageMigrationGroup {
  sourcePath: string;
  sourceType: ImageMigrationSourceType;
  sourceTitle: string;
  expanded: boolean;
  selectAll: boolean;
  images: ExternalImageReference[];
}

export interface ImageMigrationScanRequest {
  hostPattern: string;
  scanAlbums: boolean;
  scanPageContent: boolean;
  scanGroupEvents: boolean;
  scanSocialEvents: boolean;
}

export interface ImageMigrationScanResult {
  hostPattern: string;
  groups: ImageMigrationGroup[];
  totalImages: number;
  totalPages: number;
  scanDurationMs: number;
}

export interface ImageMigrationRequest {
  images: ExternalImageReference[];
  targetRootFolder: RootFolder;
  maxImageSize?: number;
}

export interface ImageMigrationProgress {
  totalImages: number;
  processedImages: number;
  successCount: number;
  failureCount: number;
  currentImage: string;
  percent: number;
}

export interface ImageMigrationResult {
  totalProcessed: number;
  successCount: number;
  failureCount: number;
  migratedImages: ExternalImageReference[];
  failedImages: ExternalImageReference[];
  cancelled?: boolean;
}

export interface ImageMigrationActivityLog {
  id: string;
  status: string;
  time: number;
  message: string;
}

export enum ExternalAlbumSource {
  FLICKR = "flickr",
  GOOGLE_PHOTOS = "google-photos",
  INSTAGRAM = "instagram"
}

export interface ExternalAlbumImportRequest {
  source: ExternalAlbumSource;
  albumUrl: string;
  targetPath: string;
  albumTitle?: string;
  albumSubtitle?: string;
  splitByPhotoTitle?: boolean;
  splitAlbumPaths?: string[];
  useTemplate?: boolean;
  templatePath?: string;
}

export interface ExternalPhoto {
  id: string;
  title: string;
  url: string;
  thumbnailUrl: string;
  dateTaken?: number;
  description?: string;
}

export interface ExternalAlbumMetadata {
  source: ExternalAlbumSource;
  id: string;
  title: string;
  description: string;
  photoCount: number;
  photos: ExternalPhoto[];
  coverPhotoUrl?: string;
}

export interface ExternalAlbumImportProgress {
  stage: string;
  percent: number;
  message: string;
}

export interface ExternalAlbumImportResult {
  success: boolean;
  source: ExternalAlbumSource;
  albumName: string;
  pageContentPath: string;
  contentMetadataId: string;
  pageContentId: string;
  photoCount: number;
  errorMessage?: string;
}

export interface SplitAlbumPreviewEntry {
  title: string;
  path: string;
  count: number;
  included: boolean;
  previewPhotos?: ExternalPhoto[];
}

export interface ExternalAlbumSummary {
  id: string;
  title: string;
  description: string;
  photoCount: number;
  coverPhotoUrl?: string;
  selected?: boolean;
  expanded?: boolean;
  targetPath?: string;
  splitPreview?: SplitAlbumPreviewEntry[];
  splitPreviewLoading?: boolean;
  splitPreviewError?: string;
  splitAlbumPaths?: string[];
}

export interface ExternalUserAlbumsMetadata {
  source: ExternalAlbumSource;
  userId: string;
  username: string;
  albums: ExternalAlbumSummary[];
  totalAlbums: number;
}

export interface FlickrScrapedPhotoData {
  id: string;
  title: string;
  sizes?: {
    o?: { url: string };
    l?: { url: string };
    c?: { url: string };
    z?: { url: string };
    m?: { url: string };
    s?: { url: string };
    sq?: { url: string };
  };
  server?: string;
  secret?: string;
  dateTaken?: string;
  description?: string;
}

export interface FlickrScrapedAlbumData {
  title: string;
  description?: string;
  owner?: {
    username?: string;
    id?: string;
  };
  photos: FlickrScrapedPhotoData[];
  totalPhotos: number;
}

export interface FlickrScrapedAlbumSummary {
  id: string;
  title: string;
  description?: string;
  photoCount: number;
  primaryPhotoServer?: string;
  primaryPhotoId?: string;
  primaryPhotoSecret?: string;
  coverPhotoUrl?: string;
}

export interface FlickrScrapedUserAlbumsData {
  username: string;
  userId: string;
  albums: FlickrScrapedAlbumSummary[];
}

export interface ExternalBulkImportRequest {
  source: ExternalAlbumSource;
  userId: string;
  basePath: string;
  albums: ExternalAlbumSummary[];
  useTemplate?: boolean;
  templatePath?: string;
  splitByPhotoTitle?: boolean;
}

export interface ExternalSourceOption {
  value: ExternalAlbumSource;
  label: string;
  singleAlbumPlaceholder: string;
  bulkAlbumsPlaceholder: string;
}

export enum ExternalAlbumImportMode {
  SINGLE = "single",
  BULK = "bulk"
}

export enum ExternalAlbumCreationMode {
  DEFAULT = "default",
  TEMPLATE = "template"
}
