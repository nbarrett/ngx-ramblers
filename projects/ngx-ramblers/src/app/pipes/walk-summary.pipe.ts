import { Pipe, PipeTransform } from "@angular/core";
import { Walk } from "../models/walk.model";
import { DisplayDatePipe } from "./display-date.pipe";

@Pipe({name: "walkSummary"})
export class WalkSummaryPipe implements PipeTransform {
  constructor(private displayDatePipe: DisplayDatePipe) {
  }

  transform(walk: Walk) {
    return walk === undefined ? null : this.displayDatePipe.transform(walk.walkDate) + " led by "
      + (walk.displayName || walk.contactName || "unknown") + " (" + (walk.briefDescriptionAndStartPoint || "no description") + ")";
  }

}
