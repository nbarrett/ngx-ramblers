import { AccessLevel } from "./member-resource.model";

export interface Link {
  href?: string;
  title?: string;
  accessLevel?: AccessLevel;
}

export enum DeviceSize {
  SMALL = 576,
  MEDIUM = 768,
  LARGE = 992,
  EXTRA_LARGE = 1200
}
