import { LinkStyle, ListStyle } from "../../../../projects/ngx-ramblers/src/app/models/content-text.model";
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
import { toGroupShortName } from "../database-initialiser";

export interface CopiedAssets {
  icons: string[];
  logos: string[];
  backgrounds: string[];
}

export interface SystemConfigTemplateParams {
  groupData: RamblersGroupsApiResponse;
  areaCode: string;
  areaName: string;
  ramblersApiConfig: RamblersApiConfig;
  googleMapsApiKey?: string;
  osMapsApiKey?: string;
  recaptchaSiteKey?: string;
  recaptchaSecretKey?: string;
  copiedAssets?: CopiedAssets;
}

function createImageEntries(fileNames: string[], defaultWidth: number = 150) {
  if (!fileNames || fileNames.length === 0) {
    return [{
      padding: 0,
      width: defaultWidth,
      originalFileName: null,
      awsFileName: null
    }];
  }
  return fileNames.map(fileName => ({
    padding: 0,
    width: defaultWidth,
    originalFileName: fileName,
    awsFileName: fileName
  }));
}

export function createSystemConfig(params: SystemConfigTemplateParams): SystemConfig {
  const { groupData, areaCode, areaName, ramblersApiConfig, googleMapsApiKey, osMapsApiKey, recaptchaSiteKey, recaptchaSecretKey, copiedAssets } = params;

  const groupShortName = toGroupShortName(groupData.name);

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
      images: createImageEntries(copiedAssets?.logos, 300)
    },
    header: {
      navigationButtons: [
        { title: "National Ramblers", href: "https://ramblers.org.uk" }
      ],
      selectedLogo: "",
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
      allowSwitchWalkView: true,
      socialDetailsPublic: true,
      href: groupData.url || groupData.external_url,
      pages: [
        { title: "Home", href: "" },
        { title: "About Us", href: "about-us" },
        { title: "Walks", href: "walks" },
        { title: "Social Events", href: "social-events" },
        { title: "News", href: "news" },
        { title: "Contact Us", href: "contact-us" },
        { title: "Photos", href: "photos" },
        { title: "How-To", href: "how-to" },
        { title: "Admin", href: "admin" }
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
      allowSwitchWalkView: true,
      socialDetailsPublic: true,
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
    enableMigration: {
      events: false
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
      href: groupData.url || groupData.external_url,
      center: groupData.latitude && groupData.longitude ? [groupData.latitude, groupData.longitude] : existingConfig.group?.center
    },
    area: {
      ...existingConfig.area,
      longName: areaName,
      groupCode: areaCode
    }
  };
}
