import { Component, inject, OnDestroy, OnInit } from "@angular/core";
import { faIdCard } from "@fortawesome/free-solid-svg-icons";
import { NgxLoggerLevel } from "ngx-logger";
import { Subscription } from "rxjs";
import { AlertTarget } from "../../../models/alert-target.model";
import { Member, ProfileUpdateType } from "../../../models/member.model";
import { Logger, LoggerFactory } from "../../../services/logger-factory.service";
import { AlertInstance, NotifierService } from "../../../services/notifier.service";
import { ProfileService } from "./profile.service";
import { PageComponent } from "../../../page/page.component";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { FormsModule } from "@angular/forms";
import { NgClass } from "@angular/common";
import { ContactUsComponent } from "../../../committee/contact-us/contact-us";
import { DisplayDatePipe } from "../../../pipes/display-date.pipe";

@Component({
    selector: "app-contact-details",
    templateUrl: "./contact-details.component.html",
    styleUrls: ["../admin/admin.component.sass"],
    imports: [PageComponent, FontAwesomeModule, FormsModule, NgClass, ContactUsComponent, DisplayDatePipe]
})
export class ContactDetailsComponent implements OnInit, OnDestroy {

  private logger: Logger = inject(LoggerFactory).createLogger("ContactDetailsComponent", NgxLoggerLevel.ERROR);
  private notifierService = inject(NotifierService);
  profileService = inject(ProfileService);

  public member: Member;
  faIdCard = faIdCard;
  private subscriptions: Subscription[] = [];
  private notify: AlertInstance;
  public notifyTarget: AlertTarget = {};

  ngOnInit() {
    this.logger.debug("ngOnInit");
    this.notify = this.notifierService.createAlertInstance(this.notifyTarget);
    this.subscriptions.push(this.profileService.subscribeToLogout(this.logger));
    this.notify.setBusy();
    this.profileService.queryMember(this.notify, ProfileUpdateType.PERSONAL_DETAILS).then(member => {
      this.member = member;
      this.notify.clearBusy();
    });
  }

  savePersonalDetails() {
    this.profileService.saveMemberDetails(this.notify, ProfileUpdateType.PERSONAL_DETAILS, this.member);
  }

  undoPersonalDetails() {
    this.profileService.undoChangesTo(this.notify, ProfileUpdateType.PERSONAL_DETAILS, this.member).then(member => {
      this.logger.debug("member:", member);
      this.member = member;
    });
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(subscription => subscription.unsubscribe());
  }

}
