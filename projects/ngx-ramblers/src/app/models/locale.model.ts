export enum SiteLocale {
  BritishEnglish = "en-GB"
}

export const SITE_TIME_ZONE = "Europe/London";

export function siteLocale(): SiteLocale {
  return SiteLocale.BritishEnglish;
}
