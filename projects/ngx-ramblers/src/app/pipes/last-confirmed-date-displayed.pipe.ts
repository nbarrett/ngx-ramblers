import { inject, Pipe, PipeTransform } from "@angular/core";
import { Member, MemberChangeStamp } from "../models/member.model";
import { DateUtilsService } from "../services/date-utils.service";

@Pipe({
    name: "lastConfirmedDateDisplayed", pure: false
})
export class LastConfirmedDateDisplayed implements PipeTransform {
  private dateUtils = inject(DateUtilsService);

  transform(member: Member, stamp: MemberChangeStamp = MemberChangeStamp.PROFILE_SETTINGS): string {
    if (stamp === MemberChangeStamp.PHOTO_VIDEO_OPT_OUT) {
      return member?.photoVideoOptOutLastUpdated ? ("by " + (member.photoVideoOptOutLastUpdatedBy || "member") + " at " + this.dateUtils.displayDateAndTime(member.photoVideoOptOutLastUpdated)) : "not changed yet";
    } else {
      return member?.profileSettingsConfirmedAt ? ("by " + (member.profileSettingsConfirmedBy || "member") + " at " + this.dateUtils.displayDateAndTime(member.profileSettingsConfirmedAt)) : "not confirmed yet";
    }
  }

}
