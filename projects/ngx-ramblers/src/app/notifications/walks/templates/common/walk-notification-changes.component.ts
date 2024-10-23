import { Component, inject } from "@angular/core";
import { WalkNotificationDetailsComponent } from "./walk-notification-details.component";
import { AuditDeltaValuePipe } from "../../../../pipes/audit-delta-value.pipe";

@Component({
  selector: "app-walk-notification-changes",
  template: `
    <table style="cellpadding:10; border:1px solid lightgrey;border-collapse:collapse;width: 100%;border-spacing: 5px;">
      <tr>
        <th width="20%" style="border:1px solid lightgrey; font-weight: bold; padding: 6px">Item changed</th>
        <th width="40%" style="border:1px solid lightgrey; font-weight: bold; padding: 6px">From</th>
        <th width="40%" style="border:1px solid lightgrey; font-weight: bold; padding: 6px">To</th>
      </tr>
      <tr *ngFor="let item of walkDataAudit.changedItems">
        <td style="border:1px solid lightgrey; padding: 6px">{{ item.fieldName | humanise }}</td>
        <td style="border:1px solid lightgrey; padding: 6px" markdown
            [data]="auditedValue(item.previousValue, item.fieldName)"></td>
        <td style="border:1px solid lightgrey; padding: 6px" markdown
            [data]="auditedValue(item.currentValue,item.fieldName)"></td>
      </tr>
    </table>`
})
export class WalkNotificationChangesComponent extends WalkNotificationDetailsComponent {

  private auditDeltaValuePipe: AuditDeltaValuePipe = inject(AuditDeltaValuePipe);

  auditedValue(previousValue: any, fieldName: string): string {
    const transformedValue = this.auditDeltaValuePipe.transform(previousValue, fieldName, this.members, "(none)");
    this.logger.off("audit:previousValue ->", previousValue, "fieldName ->", fieldName, "transformedValue:", transformedValue);
    return transformedValue?.toString();
  }
}
