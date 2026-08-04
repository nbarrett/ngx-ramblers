import { isString } from "es-toolkit/compat";
import { LinkStyle, ListStyle } from "../../../../projects/ngx-ramblers/src/app/models/content-text.model";
import { AccessLevel } from "../../../../projects/ngx-ramblers/src/app/models/member-resource.model";
import { RamblersGroupsApiResponse } from "../../../../projects/ngx-ramblers/src/app/models/ramblers-walks-manager";
import {
  defaultHeaderBar,
  defaultNavbar,
  defaultRamblersConfig,
  defaultRightPanel,
  EventPopulation,
  MailProvider,
  RootFolder,
  SystemConfig
} from "../../../../projects/ngx-ramblers/src/app/models/system.model";
import { WalkListView } from "../../../../projects/ngx-ramblers/src/app/models/walk.model";
import { RamblersApiConfig } from "../types";
import { ramblersNationalUrl } from "../../../../projects/ngx-ramblers/src/app/functions/hosts";
import { toGroupShortName } from "../database-initialiser";
import { CopiedAssets, CopiedImage } from "../../../../projects/ngx-ramblers/src/app/models/environment-setup.model";

export type { CopiedAssets };

export interface SystemConfigTemplateParams {
  groupData: RamblersGroupsApiResponse;
  siteUrl: string;
  areaCode: string;
  areaName: string;
  ramblersApiConfig: RamblersApiConfig;
  googleMapsApiKey?: string;
  osMapsApiKey?: string;
  recaptchaSiteKey?: string;
  recaptchaSecretKey?: string;
  copiedAssets?: CopiedAssets;
}

function createImageEntries(images: CopiedImage[] | string[] | undefined, defaultWidth: number = 150) {
  if (!images || images.length === 0) {
    return [{
      padding: 0,
      width: defaultWidth,
      originalFileName: null,
      awsFileName: null
    }];
  } else {
    return images.map(image => {
      if (isString(image)) {
        return {
          padding: 0,
          width: defaultWidth,
          originalFileName: image,
          awsFileName: image
        };
      } else {
        return {
          padding: image.padding ?? 0,
          width: image.width || defaultWidth,
          originalFileName: image.originalFileName,
          awsFileName: image.awsFileName
        };
      }
    });
  }
}

function siteHref(existingHref: string | undefined | null): string {
  const candidate = (existingHref || "").trim();
  return candidate && !ramblersNationalUrl(candidate) ? candidate : "";
}

function ownSiteUrl(siteUrl: string | undefined | null): string {
  const candidate = (siteUrl || "").trim();
  return candidate && !ramblersNationalUrl(candidate) ? candidate : "";
}

export function createSystemConfig(params: SystemConfigTemplateParams): SystemConfig {
  const { groupData, siteUrl, areaCode, areaName, ramblersApiConfig, googleMapsApiKey, osMapsApiKey, recaptchaSiteKey, recaptchaSecretKey, copiedAssets } = params;

  const groupShortName = toGroupShortName(groupData.name);
  const logoImages = createImageEntries(copiedAssets?.logos, 300);
  const selectedLogo = logoImages.find(image => !!image.originalFileName)?.originalFileName || "";

  return {
    globalStyles: {
      list: ListStyle.ARROW,
      link: LinkStyle.NORMAL
    },
    icons: {
      rootFolder: RootFolder.icons,
      images: createImageEntries(copiedAssets?.icons, 150)
    },
    backgrounds: {
      rootFolder: RootFolder.backgrounds,
      images: createImageEntries(copiedAssets?.backgrounds, 1920)
    },
    logos: {
      rootFolder: RootFolder.logos,
      images: logoImages
    },
    header: {
      navigationButtons: [
        { title: "National Ramblers", href: "https://ramblers.org.uk" }
      ],
      selectedLogo,
      navBar: defaultNavbar,
      headerBar: defaultHeaderBar,
      rightPanel: defaultRightPanel
    },
    footer: {
      quickLinks: [
        { title: "Powered by NGX-Ramblers 🚀", href: "https://www.ngx-ramblers.org.uk" },
        { title: `${groupData.name} on Ramblers`, href: groupData.url || groupData.external_url }
      ],
      legals: [
        { title: "Cookie Policy", href: "https://www.ramblers.org.uk/about-us/use-cookies" },
        { title: "Privacy Policy", href: "privacy-policy" }
      ],
      pages: [],
      appDownloads: {
        apple: "https://apps.apple.com/gb/app/ramblers/id1356478889",
        google: "https://play.google.com/store/apps/details?id=uk.org.ramblers.walkreg&pcampaignid=pcampaignidMKT-Other-global-all-co-prtnr-py-PartBadge-Mar2515-1"
      }
    },
    group: {
      longName: groupData.name,
      groupCode: groupData.group_code,
      shortName: groupShortName,
      defaultWalkListView: WalkListView.CARDS,
      walkPopulation: EventPopulation.WALKS_MANAGER,
      socialEventPopulation: EventPopulation.LOCAL,
      walkContactDetailsPublic: true,
      showWalkOnRamblersLink: true,
      allowSwitchWalkView: true,
      socialDetailsPublic: true,
      showSocialOnRamblersLink: true,
      href: ownSiteUrl(siteUrl),
      pages: [
        { title: "Home", href: "", accessLevel: AccessLevel.PUBLIC },
        { title: "About Us", href: "about-us", accessLevel: AccessLevel.PUBLIC },
        { title: "Walks", href: "walks", accessLevel: AccessLevel.PUBLIC },
        { title: "Social Events", href: "social-events", accessLevel: AccessLevel.PUBLIC },
        { title: "News", href: "news", accessLevel: AccessLevel.PUBLIC },
        { title: "Committee", href: "committee", accessLevel: AccessLevel.PUBLIC },
        { title: "Contact Us", href: "contact-us", accessLevel: AccessLevel.PUBLIC },
        { title: "Photos", href: "photos", accessLevel: AccessLevel.PUBLIC },
        { title: "How-To", href: "how-to", accessLevel: AccessLevel.PUBLIC },
        { title: "Admin", href: "admin", accessLevel: AccessLevel.COMMITTEE }
      ],
      groups: [],
      center: groupData.latitude && groupData.longitude ? [groupData.latitude, groupData.longitude] : null,
      zoom: 10,
      mapOutlierMaxDistanceMiles: 50
    },
    area: {
      longName: areaName,
      groupCode: areaCode,
      defaultWalkListView: WalkListView.CARDS,
      walkPopulation: EventPopulation.LOCAL,
      socialEventPopulation: EventPopulation.LOCAL,
      walkContactDetailsPublic: true,
      showWalkOnRamblersLink: true,
      allowSwitchWalkView: true,
      socialDetailsPublic: true,
      showSocialOnRamblersLink: true,
      pages: []
    },
    national: {
      mainSite: defaultRamblersConfig.mainSite,
      walksManager: {
        href: defaultRamblersConfig.walksManager.href,
        title: defaultRamblersConfig.walksManager.title,
        apiKey: ramblersApiConfig.apiKey,
        userName: ramblersApiConfig.walksManagerUsername || null,
        password: ramblersApiConfig.walksManagerPassword || null
      }
    },
    externalSystems: {
      facebook: {
        showFeed: false
      },
      instagram: {
        showFeed: false
      },
      meetup: {
        groupUrl: "https://www.meetup.com",
        apiUrl: "https://api.meetup.com",
        showFooterLink: false
      },
      osMaps: osMapsApiKey ? { apiKey: osMapsApiKey } : {}
    },
    recaptcha: {
      siteKey: recaptchaSiteKey || "",
      secretKey: recaptchaSecretKey || ""
    },
    googleMaps: {
      apiKey: googleMapsApiKey || ""
    },
    images: {
      imageLists: {
        defaultMaxImageSize: 256000,
        defaultAspectRatio: "Ramblers Landing page"
      }
    },
    googleAnalytics: {
      trackingId: ""
    },
    cloudflareWebAnalytics: {
      enabled: false,
      siteToken: null,
      siteTag: null
    },
    googleSearchConsole: {
      verificationId: null
    },
    mailDefaults: {
      mailProvider: MailProvider.BREVO,
      autoSubscribeNewMembers: true
    },
    activeChangelogCollection: "changelog"
  };
}

export function updateSystemConfigWithGroupData(
  existingConfig: Partial<SystemConfig>,
  groupData: RamblersGroupsApiResponse,
  areaCode: string,
  areaName: string
): Partial<SystemConfig> {
  return {
    ...existingConfig,
    group: {
      ...existingConfig.group,
      longName: groupData.name,
      groupCode: groupData.group_code,
      shortName: toGroupShortName(groupData.name),
      href: siteHref(existingConfig.group?.href),
      center: groupData.latitude && groupData.longitude ? [groupData.latitude, groupData.longitude] : existingConfig.group?.center
    },
    area: {
      ...existingConfig.area,
      longName: areaName,
      groupCode: areaCode
    }
  };
}
