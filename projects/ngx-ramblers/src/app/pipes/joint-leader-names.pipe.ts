import { Pipe, PipeTransform } from "@angular/core";
import { jointWalkLeaderNames } from "../functions/walks/joint-walk-leaders";

@Pipe({ name: "jointLeaderNames" })
export class JointLeaderNamesPipe implements PipeTransform {

  transform(value: string): string[] {
    const names = jointWalkLeaderNames(value);
    return names.length > 0 ? names : (value ? [value] : []);
  }

}
