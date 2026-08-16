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
import { faBell, faEnvelope, faRobot } from "@fortawesome/free-solid-svg-icons";

export interface VendorBrandMark {
  alt: string;
  logoSrc?: string;
  logoHeightPx?: number;
  icon?: IconDefinition;
  iconColor?: string;
}

const MARKS = {
  mongodb: {alt: "MongoDB", logoSrc: "assets/icons/mongodb-logo.svg", logoHeightPx: 30},
  flyIo: {alt: "Fly.io", logoSrc: "assets/icons/flyio-logo.svg", logoHeightPx: 28},
  aws: {alt: "AWS", logoSrc: "assets/icons/aws-logo.svg", logoHeightPx: 26},
  cloudflare: {alt: "Cloudflare", logoSrc: "assets/icons/cloudflare-logo.svg", logoHeightPx: 26},
  brevo: {alt: "Brevo", logoSrc: "assets/images/local/brevo.ico", logoHeightPx: 22},
  google: {alt: "Google", icon: faGoogle},
  osDataHub: {alt: "OS Data Hub", logoSrc: "assets/images/local/ordnance-survey.png", logoHeightPx: 26},
  meta: {alt: "Meta", icon: faFacebook, iconColor: "#1877F2"},
  meetup: {alt: "Meetup", logoSrc: "assets/images/local/meetup.svg", logoHeightPx: 22},
  docker: {alt: "Docker Hub", icon: faDocker, iconColor: "#2496ED"},
  github: {alt: "GitHub", icon: faGithub},
  ramblers: {alt: "Ramblers", logoSrc: "assets/images/local/favicon.ico", logoHeightPx: 22},
  salesforce: {alt: "Salesforce", icon: faSalesforce, iconColor: "#00A1E0"},
  gmail: {alt: "Gmail", icon: faEnvelope, iconColor: "#EA4335"},
  webPush: {alt: "Web Push", icon: faBell, iconColor: "#6d7470"},
  flickr: {alt: "Flickr", icon: faFlickr, iconColor: "#FF0084"},
  youtube: {alt: "YouTube", icon: faYoutube, iconColor: "#FF0000"},
  twitter: {alt: "X", icon: faXTwitter},
  ai: {alt: "AI", icon: faRobot, iconColor: "#6366f1"}
} as const satisfies Record<string, VendorBrandMark>;

const BRAND_BY_KEY: Record<string, VendorBrandMark> = {
  mongodbAtlas: MARKS.mongodb,
  flyIo: MARKS.flyIo,
  aws: MARKS.aws,
  awsS3: MARKS.aws,
  cloudflare: MARKS.cloudflare,
  brevo: MARKS.brevo,
  googleCloud: MARKS.google,
  geminiAiStudio: MARKS.google,
  googleMaps: MARKS.google,
  recaptcha: MARKS.google,
  googleAnalytics: MARKS.google,
  googleSearchConsole: MARKS.google,
  osDataHub: MARKS.osDataHub,
  meta: MARKS.meta,
  metaFacebookInstagram: MARKS.meta,
  meetup: MARKS.meetup,
  dockerHub: MARKS.docker,
  github: MARKS.github,
  walksManager: MARKS.ramblers,
  salesforce: MARKS.salesforce,
  gmailInbox: MARKS.gmail,
  webPush: MARKS.webPush,
  flickr: MARKS.flickr,
  youtube: MARKS.youtube,
  twitter: MARKS.twitter,
  aiTextGeneration: MARKS.ai
};

export interface VendorSystemSelectItem {
  value: string;
  label: string;
  brandKey?: string;
  systemId?: string;
}

export function vendorBrandByKey(key: string | null | undefined): VendorBrandMark | null {
  if (!key) {
    return null;
  } else {
    return BRAND_BY_KEY[key] || null;
  }
}

export function resolveVendorBrand(options: {
  brand?: VendorBrandMark | null;
  brandKey?: string | null;
  serviceId?: string | null;
  systemId?: string | null;
}): VendorBrandMark | null {
  if (options.brand) {
    return options.brand;
  } else {
    return vendorBrandByKey(options.brandKey)
      || vendorBrandByKey(options.serviceId)
      || vendorBrandByKey(options.systemId);
  }
}
