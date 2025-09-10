import { Pipe, PipeTransform } from "@angular/core";
import { startCase } from "es-toolkit/compat";

@Pipe({ name: "humanise" })
export class HumanisePipe implements PipeTransform {

  transform(value: string) {
    return startCase(value);
  }

}
