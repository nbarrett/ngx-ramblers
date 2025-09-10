import { Pipe, PipeTransform } from "@angular/core";
import { last } from "es-toolkit/compat";
import { without } from "es-toolkit/compat";

@Pipe({ name: "asWalkValidationsList" })
export class WalkValidationsListPipe implements PipeTransform {

  transform(walkValidations) {
    const lastItem = last(walkValidations);
    const firstItems = without(walkValidations, lastItem);
    const joiner = firstItems.length > 0 ? " and " : "";
    return firstItems.join(", ") + joiner + lastItem;
  }

}
