import { Component, inject, Input } from "@angular/core";
import { coerceBooleanProperty } from "@angular/cdk/coercion";
import { FormsModule } from "@angular/forms";
import { Member, MemberChangeStamp } from "../../../models/member.model";
import { ProfileConfirmationService } from "../../../services/profile-confirmation.service";
import { SystemConfigService } from "../../../services/system/system-config.service";
import { LastConfirmedDateDisplayed } from "../../../pipes/last-confirmed-date-displayed.pipe";

@Component({
  selector: "app-photo-video-opt-out",
  template: `
    @if (member) {
      @if (!compact) {
        <p class="text-muted mb-2">
          {{ groupName() }} takes photographs and video at walks and events for the website, Facebook page, newsletters and noticeboards.
          Tick below if you would rather not appear in them. Walk leaders may still mention a group photo on the day so you can step aside.
        </p>
        <p class="text-muted mb-2">
          Last changed {{ member | lastConfirmedDateDisplayed:MemberChangeStamp.PHOTO_VIDEO_OPT_OUT }}.
        </p>
      }
      <div class="form-check" [class.mt-3]="compact">
        <input [(ngModel)]="member.photoVideoOptOut"
               (ngModelChange)="photoVideoOptOutChanged()"
               type="checkbox" class="form-check-input"
               [id]="checkboxId()"
               name="photoVideoOptOut">
        <label class="form-check-label" [attr.for]="checkboxId()">
          @if (compact) {
            Opted out of photographs and video
            ({{ member | lastConfirmedDateDisplayed:MemberChangeStamp.PHOTO_VIDEO_OPT_OUT }})
          } @else {
            Please do not take identifiable photographs or video of me, or use them in group publicity
          }
        </label>
      </div>
    }
  `,
  imports: [FormsModule, LastConfirmedDateDisplayed]
})
export class PhotoVideoOptOutComponent {
  private profileConfirmationService = inject(ProfileConfirmationService);
  private systemConfigService = inject(SystemConfigService);

  @Input() member: Member;
  compact = false;
  protected readonly MemberChangeStamp = MemberChangeStamp;

  @Input("compact") set compactValue(value: boolean) {
    this.compact = coerceBooleanProperty(value);
  }

  checkboxId(): string {
    return this.compact ? "photo-video-opt-out-admin" : "photo-video-opt-out";
  }

  groupName(): string {
    const group = this.systemConfigService.systemConfig()?.group;
    return group?.longName || group?.shortName || "This group";
  }

  photoVideoOptOutChanged() {
    this.profileConfirmationService.recordPhotoVideoOptOutChange(this.member);
  }
}
