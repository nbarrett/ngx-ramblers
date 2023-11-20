import { IconDefinition } from "@fortawesome/fontawesome-common-types";

export enum ImageMessage {
  IMAGE_LOAD_ERROR = "Image load error",
  NO_IMAGE_SPECIFIED = "No image specified",
  NO_IMAGE_AVAILABLE = "No image available",
}

export interface FontAwesomeIcon {
  icon: IconDefinition;
  class: string;
}
