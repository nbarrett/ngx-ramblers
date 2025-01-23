import { Pipe, PipeTransform } from "@angular/core";
import { Member } from "../models/member.model";
import { DateUtilsService } from "../services/date-utils.service";

@Pipe({
    name: "lastConfirmedDateDisplayed", pure: false
})
export class LastConfirmedDateDisplayed implements PipeTransform {
  constructor(private dateUtils: DateUtilsService) {
  }

  transform(member: Member): string {
    return member?.profileSettingsConfirmedAt ? ("by " + (member.profileSettingsConfirmedBy || "member") + " at " + this.dateUtils.displayDateAndTime(member.profileSettingsConfirmedAt)) : "not confirmed yet";
  }

}
