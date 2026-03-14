import { AlertMessage, AlertTarget, AlertType } from "./alert-target.model";

export interface AlertLike {
  alertTarget: AlertTarget;
  setReady(): void;
  clearBusy(): void;
  setBusy(): boolean;
  showContactUs(state: boolean): boolean;
  notifyAlertMessage(alertType: AlertType, message?: AlertMessage | string, append?: boolean, busy?: boolean): void;
  hide(): void;
  progress(message: AlertMessage | string, busy?: boolean): void;
  success(message: AlertMessage | string, busy?: boolean): void;
  successWithAppend(message: AlertMessage | string, busy?: boolean): void;
  error(message: AlertMessage | string, append?: boolean, busy?: boolean): void;
  warning(message: AlertMessage | string, append?: boolean, busy?: boolean): void;
}
