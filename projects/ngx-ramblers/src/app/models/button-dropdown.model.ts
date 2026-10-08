import { IconDefinition } from "@fortawesome/fontawesome-common-types";

export enum ButtonDropdownItemType {
  ACTION = "action",
  DIVIDER = "divider",
  HEADER = "header"
}

export enum ButtonDropdownContainer {
  BODY = "body"
}

export enum ButtonDropdownPlacement {
  BOTTOM = "bottom",
  BOTTOM_LEFT = "bottom left",
  BOTTOM_RIGHT = "bottom right",
  LEFT = "left",
  RIGHT = "right",
  TOP = "top"
}

export interface ButtonDropdownItem {
  id: string;
  label?: string;
  extraLabel?: string;
  icon?: IconDefinition;
  type?: ButtonDropdownItemType;
  disabled?: boolean;
  danger?: boolean;
  selected?: boolean;
  hidden?: boolean;
  href?: string;
  target?: string;
  rel?: string;
  routerLink?: string | string[];
  queryParams?: Record<string, string>;
  tooltip?: string;
  tooltipPlacement?: string;
  itemClass?: string;
}
