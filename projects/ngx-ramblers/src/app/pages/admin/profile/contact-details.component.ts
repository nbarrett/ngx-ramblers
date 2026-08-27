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
import { FormSaveActionsComponent } from "../../../modules/common/form-save-actions/form-save-actions";
import { FormSaveActions } from "../../../models/form-save-actions.model";
import { HeadOfficeFieldHelpComponent, HeadOfficeLockDirective } from "../../../shared/components/head-office-field-help";

@Component({
    selector: "app-contact-details",
    template: `
    <app-page autoTitle>
      @if (member) {
        <div class="row thumbnail-heading-frame">
          <div class="thumbnail-heading">Contact details</div>
          <div class="col-12">
            <div class="row align-items-start">
              <div class="col-sm-3 text-center">
                <fa-icon [icon]="faIdCard" class="fa-5x admin-icon"/>
              </div>
              <div class="col-sm-9">
                <app-head-office-field-help [fields]="headOfficeLockableFields"/>
                <div class="border-top">
                  <div class="row">
                    <div class="col-sm-6">
                      <div class="form-group" appHeadOfficeLock="membershipNumber">
                        <label for="membershipNumber">Ramblers Membership Number</label>
                        <input [ngModel]="member.membershipNumber" type="text"
                               class="form-control input-sm"
                               name="membershipNumber"
                               id="membershipNumber"
                               placeholder="No Membership Number held">
                      </div>
                    </div>
                    <div class="col-sm-6">
                      <div class="form-group" appHeadOfficeLock="membershipExpiryDate">
                        <label for="membershipExpiryDate">Ramblers Membership Expiry Date</label>
                        <input [ngModel]="member.membershipExpiryDate | displayDate" type="text"
                               class="form-control input-sm"
                               name="membershipExpiryDate"
                               id="membershipExpiryDate"
                               placeholder="No Membership Expiry Date held">
                      </div>
                    </div>
                    <div class="col-sm-12">
                      <div class="form-group" appHeadOfficeLock="firstName">
                        <label for="prof-first-name">First Name</label>
                        <input [(ngModel)]="member.firstName" type="text" class="form-control input-sm"
                               name="firstName"
                               id="prof-first-name"
                               placeholder="Enter First Name here">
                      </div>
                    </div>
                    <div class="col-sm-12">
                      <div class="form-group" appHeadOfficeLock="lastName">
                        <label for="prof-last-name">Last Name</label>
                        <input [(ngModel)]="member.lastName" type="text" required class="form-control input-sm"
                               id="prof-last-name"
                               name="lastName"
                               placeholder="Enter Last Name here">
                      </div>
                    </div>
                    <div class="col-sm-12">
                      <div class="form-group" appHeadOfficeLock="mobileNumber">
                        <label for="prof-mobile-number">Mobile Number</label>
                        <input [(ngModel)]="member.mobileNumber" type="text" required class="form-control input-sm"
                               id="prof-mobile-number"
                               name="mobileNumber"
                               placeholder="Enter mobile number here">
                      </div>
                    </div>
                    <div class="col-sm-12">
                      <div class="form-group" appHeadOfficeLock="email">
                        <label for="prof-contact-email">Contact Email</label>
                        <input [(ngModel)]="member.email" type="text" required class="form-control input-sm"
                               id="prof-contact-email"
                               name="email"
                               placeholder="Enter contact email here">
                      </div>
                    </div>
                    <div class="col-sm-12">
                      <div class="form-group mb-0" appHeadOfficeLock="postcode">
                        <label for="prof-postcode">Home postcode</label>
                        <input [(ngModel)]="member.postcode" type="text" required class="form-control input-sm"
                               id="prof-postcode"
                               name="postcode"
                               placeholder="Enter home postcode here">
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div class="mt-3">
          <app-form-save-actions
            [disabled]="!member || notifyTarget.busy"
            [actions]="formSaveActions"/>
        </div>
      }
      @if (notifyTarget.showAlert) {
        <div class="alert {{notifyTarget.alertClass}} mt-3">
          <fa-icon [icon]="notifyTarget.alert.icon"></fa-icon>
          @if (notifyTarget.alertTitle) {
            <strong>
              {{ notifyTarget.alertTitle }}: </strong>
          } {{ notifyTarget.alertMessage }}
          @if (notifyTarget.showContactUs) {
            <div> contact our
              <app-contact-us class="alert-link"></app-contact-us>.
            </div>
          }
        </div>
      }
    </app-page>
  `,
    styleUrls: ["../admin/admin.component.sass"],
    imports: [PageComponent, FontAwesomeModule, FormsModule, ContactUsComponent, DisplayDatePipe, FormSaveActionsComponent, HeadOfficeFieldHelpComponent, HeadOfficeLockDirective]
})
export class ContactDetailsComponent implements OnInit, OnDestroy {

  private logger: Logger = inject(LoggerFactory).createLogger("ContactDetailsComponent", NgxLoggerLevel.ERROR);
  private notifierService = inject(NotifierService);
  private memberSyncPolicyService = inject(MemberSyncPolicyService);
  profileService = inject(ProfileService);

  public member: Member;
  faIdCard = faIdCard;
  readonly headOfficeLockableFields = ["membershipNumber", "membershipExpiryDate", "firstName", "lastName", "mobileNumber", "email", "postcode"];
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
