import {
  BannerConfig,
  BannerType,
  LogoAndTextLinesBanner
} from "../../../../../projects/ngx-ramblers/src/app/models/banner-configuration.model";
import { Image, RootFolder } from "../../../../../projects/ngx-ramblers/src/app/models/system.model";
import { dateTimeNowAsValue } from "../../../shared/dates";

const CLOUDY = "colour-cloudy";

function wordsFor(indexFrom: number, indexTo: number | null, words: string[]): string {
  const text = words.length < 1
    ? "Some Text"
    : words.slice(indexFrom, indexTo ? indexFrom + indexTo : words.length).filter(Boolean).join(" ");
  return text;
}

export function createDefaultLogoAndTextBanner(
  groupLongName: string,
  logoImage: Image | null
): BannerConfig {
  const groupWords = (groupLongName || "Group").trim().split(/\s+/).filter(Boolean);
  const logo: LogoAndTextLinesBanner["logo"] = {
    columns: 12,
    bannerImageType: RootFolder.logos,
    show: true,
    image: logoImage
      ? {
          padding: 10,
          width: logoImage.width || 300,
          originalFileName: logoImage.originalFileName,
          awsFileName: logoImage.awsFileName
        }
      : {padding: 10, width: 300}
  };
  const banner: LogoAndTextLinesBanner = {
    logo,
    line1: {
      fontSize: 33,
      include: true,
      showIcon: false,
      part1: {value: wordsFor(0, 1, groupWords), class: CLOUDY, show: true},
      part2: {value: wordsFor(1, 1, groupWords), class: CLOUDY, show: true},
      part3: {value: wordsFor(2, null, groupWords), class: CLOUDY, show: true}
    },
    line2: {
      include: true,
      fontSize: 33,
      showIcon: false,
      part1: {value: "Walk", class: CLOUDY, show: true},
      part2: {value: "Leader", class: CLOUDY, show: true},
      part3: {value: "Notification", class: CLOUDY, show: true}
    }
  };
  return {
    name: `${groupLongName} Full Width Banner`,
    bannerType: BannerType.LOGO_AND_TEXT_LINES,
    banner,
    createdAt: dateTimeNowAsValue(),
    createdBy: "system"
  };
}
