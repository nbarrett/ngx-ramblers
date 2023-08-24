import { Pipe, PipeTransform } from "@angular/core";
import { NumberUtilsService } from "../services/number-utils.service";

@Pipe({name: "asMoney"})
export class MoneyPipe implements PipeTransform {
  constructor(private    numberUtils: NumberUtilsService) {
  }

  transform(value: any) {
    return isNaN(value) ? "" : "£" + this.numberUtils.asNumber(value).toFixed(2);
  }
}
