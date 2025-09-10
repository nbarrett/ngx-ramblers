import { Pipe, PipeTransform } from "@angular/core";
import { startCase } from "es-toolkit/compat";
import { ChangedItem } from "../models/changed-item.model";

@Pipe({ name: "toAuditDeltaChangedItems" })
export class AuditDeltaChangedItemsPipePipe implements PipeTransform {

  transform(changedItems: ChangedItem[]): string {
    return changedItems.map(item => startCase(item.fieldName)).join(", ");
  }
}
