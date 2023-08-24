import { FontAwesomeIcon } from "./images.model";

export interface AlertTarget {
  alertMessage?: string;
  showAlert?: boolean;
  alertClass?: string;
  alert?: AlertType;
  alertTitle?: string;
  alertMessages?: string[];
  showContactUs?: boolean;
  busy?: boolean;
  ready?: boolean;
}

export interface AlertType extends FontAwesomeIcon {
  failure?: boolean;
}

export interface AlertMessage {
  title: string;
  message: any;
  continue?: boolean;
}
