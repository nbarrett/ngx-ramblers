import { inject, Pipe, PipeTransform } from "@angular/core";
import { DisplayDatePipe } from "./display-date.pipe";
import { ExtendedGroupEvent } from "../models/group-event.model";
import { isUndefined } from "es-toolkit/compat";

@Pipe({ name: "walkSummary" })
export class WalkSummaryPipe implements PipeTransform {

  private displayDatePipe = inject(DisplayDatePipe);


  transform(walk: ExtendedGroupEvent) {
    return isUndefined(walk) ? null : `${this.displayDatePipe.transform(walk?.groupEvent?.start_date_time)} led by ${walk?.fields?.contactDetails?.displayName || walk?.fields?.contactDetails?.phone || "unknown"} (${walk?.groupEvent?.title || "no description"})`;
  }

}
