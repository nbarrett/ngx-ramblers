import { inject } from "@angular/core";
import { LoggerFactory } from "../../services/logger-factory.service";
import { NgxLoggerLevel } from "ngx-logger";
import { RouterStateSnapshot } from "@angular/router";
import { isUndefined } from "es-toolkit/compat";
import { ContactUsModalService } from "./contact-us-modal.service";
import { StoredValue } from "../../models/ui-actions";

export function contactUsGuard(route: any, state: RouterStateSnapshot) {
  const modalService = inject(ContactUsModalService);
  const loggerFactory: LoggerFactory = inject(LoggerFactory);
  const logger = loggerFactory.createLogger("contactModalGuard", NgxLoggerLevel.ERROR);
  logger.info("contactModalGuard:route:", route, "state:", state);
  const contactUs = route.queryParams[StoredValue.CONTACT_US];
  if (isUndefined(contactUs)) {
    logger.info("contactModalGuard:no contactUs");
    return true;
  } else {
    logger.info("contactModalGuard:contactUs:", contactUs);
    modalService.openContactModal(route.queryParams);
    return false;
  }

}
