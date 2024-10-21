import { inject, Injectable } from "@angular/core";
import { BsModalService } from "ngx-bootstrap/modal";
import { ActivatedRoute, Params, Router } from "@angular/router";
import { filter } from "rxjs/operators";
import { ContactUsModalComponent } from "./contact-us-modal.component";
import { LoggerFactory } from "../../services/logger-factory.service";
import { NgxLoggerLevel } from "ngx-logger";

@Injectable({
  providedIn: "root"
})
export class ContactUsModalService {
  private modalService = inject(BsModalService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private loggerFactory = inject(LoggerFactory);
  private logger = this.loggerFactory.createLogger("ModalService", NgxLoggerLevel.ERROR);

  constructor() {
    this.logger.info("ModalService constructed");

    this.route.queryParams.pipe(
      filter(params => !!params["contact-us"])).subscribe(queryParams => {
      this.logger.info("queryParams detected:", queryParams);
      this.openContactModal(queryParams);
    });
  }

  openContactModal(queryParams: Params) {
    this.modalService.show(ContactUsModalComponent, {
      initialState: {queryParams}
    }).onHidden.subscribe(() => {
      this.logger.info("Modal closed");
    });
    this.logger.info("Modal opened with queryParams:", queryParams);
    this.redirectBackToRoute(queryParams);
  }

  redirectBackToRoute(queryParams: Params) {
    const path = queryParams["redirect"];
    this.logger.info("Redirecting to:", path);
    this.router.navigate([path]);
  }

}
