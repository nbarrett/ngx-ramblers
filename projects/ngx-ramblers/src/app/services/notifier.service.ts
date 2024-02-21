import { Injectable } from "@angular/core";
import { faPencil } from "@fortawesome/free-solid-svg-icons";
import { NgxLoggerLevel } from "ngx-logger";
import {
  ALERT_ERROR,
  ALERT_INFO,
  ALERT_SUCCESS,
  ALERT_WARNING,
  AlertMessage,
  AlertTarget,
  AlertType
} from "../models/alert-target.model";
import { Logger, LoggerFactory } from "./logger-factory.service";
import { StringUtilsService } from "./string-utils.service";


export class AlertInstance {
  private logger: Logger;
  faPencil = faPencil;
  constructor(public alertTarget: AlertTarget, level: NgxLoggerLevel, loggerFactory: LoggerFactory, private stringUtils: StringUtilsService) {
    this.logger = loggerFactory.createLogger(AlertInstance, level || NgxLoggerLevel.ERROR);
    this.alertTarget.alertClass = ALERT_SUCCESS.class;
    this.alertTarget.alert = ALERT_SUCCESS;
  }

  setReady() {
    this.clearBusy();
    this.alertTarget.ready = true;
  }

  clearBusy() {
    this.logger.debug("clearing busy");
    this.alertTarget.busy = false;
  }

  setBusy() {
    this.logger.debug("setting busy");
    return this.alertTarget.busy = true;
  }

  showContactUs(state) {
    this.logger.debug("setting showContactUs", state);
    return this.alertTarget.showContactUs = state;
  }

  notifyAlertMessage(alertType: AlertType, message?: AlertMessage | string, append?: boolean, busy?: boolean) {

    const messageText = this.stringUtils.stringify(message);
    this.logger.debug("notifyAlertMessage:alertType:", alertType, "message:", message);
    if (busy) {
      this.setBusy();
    }
    if (!append || alertType === ALERT_ERROR || !this.alertTarget.alertMessages) {
      this.alertTarget.alertMessages = [];
    }
    if (messageText) {
      this.alertTarget.alertMessages.push(messageText);
    }
    this.alertTarget.alertTitle = this.stringUtils.isAlertMessage(message) ? message.title : undefined;
    this.alertTarget.alert = alertType;
    this.alertTarget.alertClass = alertType.class;
    this.alertTarget.showAlert = this.alertTarget.alertMessages.length > 0;
    this.alertTarget.alertMessage = this.alertTarget.alertMessages.join(", ");
    if (alertType === ALERT_ERROR) {
      this.clearBusy();
      if (this.stringUtils.isAlertMessage(message) && !message.continue) {
        this.logger.error("notifyAlertMessage:", "alertType:", alertType, "messageText:", messageText, "message:", message);
        throw message;
      } else {
        return this.logger.debug("notifyAlertMessage:", "alertType:", alertType, "messageText:", messageText, "message:", message, "alertMessages:", this.alertTarget.alertMessages, "showAlert:", this.alertTarget.showAlert);
      }
    }
  }

  hide() {
    this.notifyAlertMessage(ALERT_SUCCESS);
    this.clearBusy();
  }

  progress(message: AlertMessage | string, busy?: boolean) {
    return this.notifyAlertMessage(ALERT_INFO, message, false, busy);
  }

  success(message: AlertMessage | string, busy?: boolean) {
    return this.notifyAlertMessage(ALERT_SUCCESS, message, false, busy);
  }

  successWithAppend(message: AlertMessage | string, busy?: boolean) {
    return this.notifyAlertMessage(ALERT_SUCCESS, message, true, busy);
  }

  error(message: AlertMessage | string, append?: boolean, busy?: boolean) {
    return this.notifyAlertMessage(ALERT_ERROR, message, append, busy);
  }

  warning(message: AlertMessage | string, append?: boolean, busy?: boolean) {
    return this.notifyAlertMessage(ALERT_WARNING, message, append, busy);
  }

}

@Injectable({
  providedIn: "root"
})

export class NotifierService {

  constructor(private stringUtils: StringUtilsService, private loggerFactory: LoggerFactory) {
  }

  createAlertInstance(alertTarget: AlertTarget, level?: NgxLoggerLevel): AlertInstance {
    return new AlertInstance(alertTarget, level, this.loggerFactory, this.stringUtils);
  }

}

