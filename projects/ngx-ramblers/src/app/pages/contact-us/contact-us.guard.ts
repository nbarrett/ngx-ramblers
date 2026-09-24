import { inject } from "@angular/core";
import { LoggerFactory } from "../../services/logger-factory.service";
import { NgxLoggerLevel } from "ngx-logger";
import { RouterStateSnapshot } from "@angular/router";
import { ContactUsModalService } from "./contact-us-modal.service";
import { contactUsRequested } from "../../modules/common/tiptap-editor/contact-us-link";

export function contactUsGuard(route: any, state: RouterStateSnapshot) {
  const modalService = inject(ContactUsModalService);
  const loggerFactory: LoggerFactory = inject(LoggerFactory);
  const logger = loggerFactory.createLogger("contactModalGuard", NgxLoggerLevel.ERROR);
  logger.info("contactModalGuard:route:", route, "state:", state);
  if (!contactUsRequested(route.queryParams)) {
    logger.info("contactModalGuard:no contactUs");
    return true;
  } else {
    logger.info("contactModalGuard:contactUs:", route.queryParams);
    modalService.openContactModal(route.queryParams);
    return true;
  }

}
