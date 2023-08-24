import { Pipe, PipeTransform } from "@angular/core";
import startCase from "lodash-es/startCase";

@Pipe({name: "humanise"})
export class HumanisePipe implements PipeTransform {

  transform(value: string) {
    return startCase(value);
  }

}
