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

export interface HasClass {
  class: string;
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
