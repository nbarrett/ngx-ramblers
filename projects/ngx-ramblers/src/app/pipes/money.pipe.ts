import { Pipe, PipeTransform } from "@angular/core";
import { NumberUtilsService } from "../services/number-utils.service";

@Pipe({
  name: "asMoney",
  standalone: false
})
export class MoneyPipe implements PipeTransform {
  constructor(private    numberUtils: NumberUtilsService) {
  }

  transform(value: any) {
    return isNaN(value) ? "" : "£" + this.numberUtils.asNumber(value).toFixed(2);
  }
}
