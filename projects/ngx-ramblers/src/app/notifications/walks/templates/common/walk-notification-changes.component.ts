import { Component } from "@angular/core";
import { WalkNotificationDetailsComponent } from "./walk-notification-details.component";


@Component({
  selector: "app-walk-notification-changes",
  template: `
    <table style="cellpadding:10; border:1px solid lightgrey;border-collapse:collapse;width: 100%;border-spacing: 5px;">
      <tr>
        <th width="20%" style="border:1px solid lightgrey; font-weight: bold; padding: 6px">Item changed</th>
        <th width="40%" style="border:1px solid lightgrey; font-weight: bold; padding: 6px">From</th>
        <th width="40%" style="border:1px solid lightgrey; font-weight: bold; padding: 6px">To</th>
      </tr>
      <tr *ngFor="let item of walkDataAudit?.changedItems">
        <td style="border:1px solid lightgrey; padding: 6px">{{ item.fieldName | humanise }}</td>
          <td style="border:1px solid lightgrey; padding: 6px" [innerHTML]="renderMarked(item.previousValue)"></td>
          <td style="border:1px solid lightgrey; padding: 6px" [innerHTML]="renderMarked(item.currentValue) "></td>
      </tr>
    </table>
  `,
  standalone: false
})
export class WalkNotificationChangesComponent extends WalkNotificationDetailsComponent {

}
