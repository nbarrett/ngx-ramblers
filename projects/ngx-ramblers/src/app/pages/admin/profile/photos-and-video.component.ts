import { Component, inject, OnDestroy, OnInit } from "@angular/core";
import { faCamera } from "@fortawesome/free-solid-svg-icons";
import { NgxLoggerLevel } from "ngx-logger";
import { Subscription } from "rxjs";
import { AlertTarget } from "../../../models/alert-target.model";
import { Member, ProfileUpdateType } from "../../../models/member.model";
import { FormSaveActions } from "../../../models/form-save-actions.model";
import { Logger, LoggerFactory } from "../../../services/logger-factory.service";
import { AlertInstance, NotifierService } from "../../../services/notifier.service";
import { ProfileService } from "./profile.service";
import { PageComponent } from "../../../page/page.component";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { ContactUsComponent } from "../../../committee/contact-us/contact-us";
import { FormSaveActionsComponent } from "../../../modules/common/form-save-actions/form-save-actions";
import { PhotoVideoOptOutComponent } from "./photo-video-opt-out";

@Component({
  selector: "app-photos-and-video",
  template: `
    <app-page pageTitle="Photos and video">
      @if (member) {
        <div class="row thumbnail-heading-frame">
          <div class="thumbnail-heading">Photos and video</div>
          <div class="col-12">
            <div class="row align-items-start">
              <div class="col-sm-3 text-center">
                <fa-icon [icon]="faCamera" class="fa-5x admin-icon"/>
              </div>
              <div class="col-sm-9">
                <app-photo-video-opt-out [member]="member"/>
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
            <strong>{{ notifyTarget.alertTitle }}: </strong>
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
  imports: [PageComponent, FontAwesomeModule, ContactUsComponent, FormSaveActionsComponent, PhotoVideoOptOutComponent]
})
export class PhotosAndVideoComponent implements OnInit, OnDestroy {
  private logger: Logger = inject(LoggerFactory).createLogger("PhotosAndVideoComponent", NgxLoggerLevel.ERROR);
  private notifierService = inject(NotifierService);
  profileService = inject(ProfileService);

  public member: Member;
  faCamera = faCamera;
  private subscriptions: Subscription[] = [];
  private notify: AlertInstance;
  public notifyTarget: AlertTarget = {};
  public formSaveActions: FormSaveActions = {
    save: () => this.savePhotosAndVideo(),
    saveAndExit: () => this.saveAndExit(),
    undo: () => this.undoPhotosAndVideo(),
    cancel: () => this.profileService.backToAdmin()
  };

  ngOnInit() {
    this.logger.debug("ngOnInit");
    this.notify = this.notifierService.createAlertInstance(this.notifyTarget);
    this.notify.setBusy();
    this.subscriptions.push(this.profileService.subscribeToLogout(this.logger));
    this.profileService.queryMember(this.notify, ProfileUpdateType.PHOTOS_AND_VIDEO).then(member => {
      this.member = member;
      this.notify.clearBusy();
    });
  }

  savePhotosAndVideo(): Promise<void> {
    return this.profileService.saveMemberDetails(this.notify, ProfileUpdateType.PHOTOS_AND_VIDEO, this.member);
  }

  saveAndExit(): Promise<void> {
    return this.savePhotosAndVideo().then(() => {
      this.profileService.backToAdmin();
    }).catch(() => null);
  }

  undoPhotosAndVideo() {
    return this.profileService.undoChangesTo(this.notify, ProfileUpdateType.PHOTOS_AND_VIDEO, this.member).then(member => {
      this.member = member;
    });
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(subscription => subscription.unsubscribe());
  }
}
