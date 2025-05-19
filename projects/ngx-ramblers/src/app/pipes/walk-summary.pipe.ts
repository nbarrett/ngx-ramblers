import { inject, Pipe, PipeTransform } from "@angular/core";
import { DisplayDatePipe } from "./display-date.pipe";

import { Walk } from "../models/deprecated";
import { ExtendedGroupEvent } from "../models/group-event.model";

@Pipe({ name: "walkSummary" })
export class WalkSummaryPipe implements PipeTransform {

  private displayDatePipe = inject(DisplayDatePipe);


  transform(walk: ExtendedGroupEvent) {
    return walk === undefined ? null : this.displayDatePipe.transform(walk.groupEvent.start_date_time) + " led by "
      + (walk.fields.contactDetails.phone || walk.fields.contactDetails.displayName || "unknown") + " (" + (walk.groupEvent.title || "no description") + ")";
  }

}
