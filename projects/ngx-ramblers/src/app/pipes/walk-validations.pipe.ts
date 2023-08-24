import { Pipe, PipeTransform } from "@angular/core";
import last from "lodash-es/last";
import without from "lodash-es/without";

@Pipe({name: "asWalkValidationsList"})
export class WalkValidationsListPipe implements PipeTransform {

  transform(walkValidations) {
    const lastItem = last(walkValidations);
    const firstItems = without(walkValidations, lastItem);
    const joiner = firstItems.length > 0 ? " and " : "";
    return firstItems.join(", ") + joiner + lastItem;
  }

}
