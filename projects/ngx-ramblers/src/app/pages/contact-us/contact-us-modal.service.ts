import { inject, Injectable } from "@angular/core";
import { BsModalService } from "ngx-bootstrap/modal";
import { ActivatedRoute, Params, Router } from "@angular/router";
import { filter } from "rxjs/operators";
import { ContactUsModalComponent } from "./contact-us-modal.component";
import { LoggerFactory } from "../../services/logger-factory.service";
import { NgxLoggerLevel } from "ngx-logger";
import { CommitteeMember } from "../../models/committee.model";

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
    const enriched = this.withCurrentPath(queryParams);
    this.modalService.show(ContactUsModalComponent, {
      class: "modal-lg",
      initialState: {queryParams: enriched}
    }).onHidden.subscribe(() => {
      this.logger.info("Modal closed");
    });
    this.logger.info("Modal opened with queryParams:", enriched);
    this.redirectBackToRoute(enriched);
  }

  openContactModalForMember(committeeMember: CommitteeMember, subject: string, redirect?: string) {
    this.modalService.show(ContactUsModalComponent, {
      class: "modal-lg",
      initialState: {
        committeeMemberOverride: committeeMember,
        queryParams: this.withCurrentPath({subject, redirect})
      }
    }).onHidden.subscribe(() => {
      this.logger.info("Modal closed");
    });
    this.logger.info("Modal opened for member:", committeeMember);
  }

  openContactModalForRole(role: string, subject: string, redirect?: string) {
    this.modalService.show(ContactUsModalComponent, {
      class: "modal-lg",
      initialState: {
        queryParams: this.withCurrentPath({"contact-us": true, role, subject, redirect})
      }
    }).onHidden.subscribe(() => {
      this.logger.info("Modal closed");
    });
    this.logger.info("Modal opened for role:", role);
  }

  private withCurrentPath(queryParams: Params): Params {
    return {
      ...queryParams,
      redirect: queryParams["redirect"] || window.location.pathname
    };
  }

  redirectBackToRoute(queryParams: Params) {
    const path = queryParams["redirect"];
    this.logger.info("Redirecting to:", path);
    this.router.navigate([path]);
  }

}
