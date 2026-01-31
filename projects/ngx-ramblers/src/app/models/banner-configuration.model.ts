import { ApiResponse } from "./api-response.model";
import { Image, RootFolder } from "./system.model";
import { ServerFileNameData } from "./aws-object.model";

export interface BannerImageItem {
  bannerImageType: RootFolder;
  columns?: number;
  fontSize?: number;
  image: Image,
  show: boolean;
}

export interface BannerTextItem extends HasClass {
  columns?: number;
  fontSize?: number;
  padding?: number;
  show: boolean;
  value: string,
  width?: number;
}

export interface TitleLine {
  include?: boolean;
  showIcon?: boolean;
  fontSize?: number;
  image?: Image;
  part1?: BannerTextItem;
  part2?: BannerTextItem;
  part3?: BannerTextItem;
}

export function defaultTitleLine(): TitleLine {
  return {
    include: true,
    showIcon: true,
    fontSize: 33,
    part1: { value: "", class: "", show: true },
    part2: { value: "", class: "", show: true },
    part3: { value: "", class: "", show: true }
  };
}

export function ensureTitleLine(titleLine: TitleLine | null): TitleLine {
  const base = defaultTitleLine();
  const incoming = titleLine || {};
  const part1 = { ...base.part1, ...(incoming.part1 || {}) };
  const part2 = { ...base.part2, ...(incoming.part2 || {}) };
  const part3 = { ...base.part3, ...(incoming.part3 || {}) };
  return {
    include: incoming.include ?? base.include,
    showIcon: incoming.showIcon ?? base.showIcon,
    fontSize: incoming.fontSize ?? base.fontSize,
    image: incoming.image || base.image,
    part1,
    part2,
    part3
  };
}

export interface HasClass {
  class: string;
}

export interface HasColour {
  colour: string;
}

export interface PapercutBackgroundBanner {
  photo: BannerImageItem
  logo: BannerImageItem
  background: BannerImageItem
  text: BannerTextItem
}

export interface LogoAndTextLinesBanner {
  logo: BannerImageItem
  line1: TitleLine
  line2: TitleLine
}

export enum BannerType {
  PAPERCUT_BACKGROUND = "papercut-background",
  LOGO_AND_TEXT_LINES = "logo-and-text-lines",
}

export interface BannerConfig {
  id?: string;
  name: string;
  bannerType: BannerType;
  banner: PapercutBackgroundBanner | LogoAndTextLinesBanner
  createdAt?: number;
  createdBy?: string;
  updatedAt?: number;
  updatedBy?: string;
  fileNameData?: ServerFileNameData;
}

export interface BannerConfigApiResponse extends ApiResponse {
  request: any;
  response?: BannerConfig | BannerConfig[];
}
