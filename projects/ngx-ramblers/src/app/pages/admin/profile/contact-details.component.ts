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
import { ContactUsComponent } from "../../../committee/contact-us/contact-us";
import { DisplayDatePipe } from "../../../pipes/display-date.pipe";
import { MemberSyncPolicyService } from "../../../services/member/member-sync-policy.service";
import { MemberSyncPolicyMode } from "../../../models/member-sync-policy.model";
import { FormSaveActionsComponent } from "../../../modules/common/form-save-actions/form-save-actions";
import { FormSaveActions } from "../../../models/form-save-actions.model";

@Component({
    selector: "app-contact-details",
    templateUrl: "./contact-details.component.html",
    styleUrls: ["../admin/admin.component.sass"],
    imports: [PageComponent, FontAwesomeModule, FormsModule, ContactUsComponent, DisplayDatePipe, FormSaveActionsComponent]
})
export class ContactDetailsComponent implements OnInit, OnDestroy {

  private logger: Logger = inject(LoggerFactory).createLogger("ContactDetailsComponent", NgxLoggerLevel.ERROR);
  private notifierService = inject(NotifierService);
  private memberSyncPolicyService = inject(MemberSyncPolicyService);
  profileService = inject(ProfileService);

  public member: Member;
  faIdCard = faIdCard;
  private subscriptions: Subscription[] = [];
  private notify: AlertInstance;
  public notifyTarget: AlertTarget = {};
  public formSaveActions: FormSaveActions = {
    save: () => this.savePersonalDetails(),
    saveAndExit: () => this.saveAndExit(),
    undo: () => this.undoPersonalDetails(),
    cancel: () => this.profileService.backToAdmin()
  };

  ngOnInit() {
    this.logger.debug("ngOnInit");
    this.notify = this.notifierService.createAlertInstance(this.notifyTarget);
    this.subscriptions.push(this.profileService.subscribeToLogout(this.logger));
    this.memberSyncPolicyService.refresh();
    this.notify.setBusy();
    this.profileService.queryMember(this.notify, ProfileUpdateType.PERSONAL_DETAILS).then(member => {
      this.member = member;
      this.notify.clearBusy();
    });
  }

  isFieldReadonly(fieldName: string): boolean {
    return this.memberSyncPolicyService.effectiveMode(fieldName) === MemberSyncPolicyMode.ALWAYS_APPLY_HEAD_OFFICE;
  }

  savePersonalDetails(): Promise<void> {
    return this.profileService.saveMemberDetails(this.notify, ProfileUpdateType.PERSONAL_DETAILS, this.member);
  }

  saveAndExit(): Promise<void> {
    return this.savePersonalDetails().then(() => {
      this.profileService.backToAdmin();
    }).catch(() => null);
  }

  undoPersonalDetails() {
    return this.profileService.undoChangesTo(this.notify, ProfileUpdateType.PERSONAL_DETAILS, this.member).then(member => {
      this.logger.debug("member:", member);
      this.member = member;
    });
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(subscription => subscription.unsubscribe());
  }

}
