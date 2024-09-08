import { FontAwesomeIcon } from "./images.model";
import { faCircleCheck, faCircleExclamation, faCircleInfo } from "@fortawesome/free-solid-svg-icons";

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
  type: string;
}

export interface AlertMessageAndType {
  message: AlertMessage;
  type: AlertLevel;
}

export interface AlertMessage {
  title: string;
  message: any;
  continue?: boolean;
}

export const ALERT_ERROR: AlertType = {type: "danger", class: "alert-danger", icon: faCircleExclamation, failure: true};
export const ALERT_WARNING: AlertType = {type: "warning", class: "alert-warning", icon: faCircleCheck};
export const ALERT_INFO: AlertType = {type: "success", class: "alert-success", icon: faCircleInfo};
export const ALERT_SUCCESS: AlertType = {type: "success", class: "alert-success", icon: faCircleCheck};

export enum AlertLevel {
  ALERT_ERROR = "ALERT_ERROR",
  ALERT_WARNING = "ALERT_WARNING",
  ALERT_INFO = "ALERT_INFO",
  ALERT_SUCCESS = "ALERT_SUCCESS"

}
