import { IconDefinition } from "@fortawesome/fontawesome-svg-core";
import {
  faDocker,
  faFacebook,
  faFlickr,
  faGithub,
  faGoogle,
  faSalesforce,
  faXTwitter,
  faYoutube
} from "@fortawesome/free-brands-svg-icons";
import { faEnvelope, faRobot } from "@fortawesome/free-solid-svg-icons";

export interface VendorBrandMark {
  alt: string;
  logoSrc?: string;
  logoHeightPx?: number;
  icon?: IconDefinition;
  iconColor?: string;
}

const CONSOLE_SERVICE_BRANDS: Record<string, VendorBrandMark> = {
  mongodbAtlas: {alt: "MongoDB", logoSrc: "assets/icons/mongodb-logo.svg", logoHeightPx: 30},
  flyIo: {alt: "Fly.io", logoSrc: "assets/icons/flyio-logo.svg", logoHeightPx: 28},
  aws: {alt: "AWS", logoSrc: "assets/icons/aws-logo.svg", logoHeightPx: 26},
  cloudflare: {alt: "Cloudflare", logoSrc: "assets/icons/cloudflare-logo.svg", logoHeightPx: 26},
  brevo: {alt: "Brevo", logoSrc: "assets/images/local/brevo.ico", logoHeightPx: 22},
  googleCloud: {alt: "Google Cloud", icon: faGoogle},
  osDataHub: {alt: "OS Data Hub", logoSrc: "assets/images/local/ordnance-survey.png", logoHeightPx: 26},
  meta: {alt: "Meta", icon: faFacebook},
  meetup: {alt: "Meetup", logoSrc: "assets/images/local/meetup.svg", logoHeightPx: 22},
  dockerHub: {alt: "Docker Hub", icon: faDocker},
  github: {alt: "GitHub", icon: faGithub}
};

const THIRD_PARTY_SYSTEM_BRANDS: Record<string, VendorBrandMark> = {
  mongodbAtlas: CONSOLE_SERVICE_BRANDS.mongodbAtlas,
  awsS3: CONSOLE_SERVICE_BRANDS.aws,
  flyIo: CONSOLE_SERVICE_BRANDS.flyIo,
  cloudflare: CONSOLE_SERVICE_BRANDS.cloudflare,
  googleMaps: {alt: "Google Maps", icon: faGoogle},
  osDataHub: CONSOLE_SERVICE_BRANDS.osDataHub,
  recaptcha: {alt: "reCAPTCHA", icon: faGoogle},
  brevo: CONSOLE_SERVICE_BRANDS.brevo,
  walksManager: {alt: "Ramblers", logoSrc: "/favicon.svg", logoHeightPx: 24},
  metaFacebookInstagram: CONSOLE_SERVICE_BRANDS.meta,
  meetup: CONSOLE_SERVICE_BRANDS.meetup,
  salesforce: {alt: "Salesforce", icon: faSalesforce},
  googleAnalytics: {alt: "Google Analytics", icon: faGoogle},
  googleSearchConsole: {alt: "Google Search Console", icon: faGoogle},
  gmailInbox: {alt: "Gmail", icon: faEnvelope},
  webPush: {alt: "Web Push", icon: faEnvelope},
  flickr: {alt: "Flickr", icon: faFlickr},
  youtube: {alt: "YouTube", icon: faYoutube, iconColor: "#FF0000"},
  twitter: {alt: "X", icon: faXTwitter},
  aiTextGeneration: {alt: "AI", icon: faRobot}
};

export interface VendorSystemSelectItem {
  value: string;
  label: string;
  brandKey?: string;
  systemId?: string;
}

export function vendorBrandForConsoleService(serviceId: string): VendorBrandMark | null {
  return CONSOLE_SERVICE_BRANDS[serviceId] || null;
}

export function vendorBrandForThirdPartySystem(systemId: string): VendorBrandMark | null {
  return THIRD_PARTY_SYSTEM_BRANDS[systemId] || null;
}

export function vendorBrandByKey(key: string): VendorBrandMark | null {
  return CONSOLE_SERVICE_BRANDS[key] || THIRD_PARTY_SYSTEM_BRANDS[key] || null;
}
