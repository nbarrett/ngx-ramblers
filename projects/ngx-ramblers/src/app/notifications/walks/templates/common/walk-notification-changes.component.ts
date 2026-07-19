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
      @for (item of walkDataAudit?.notificationChangedItems; track item.field) {
        <tr>
          <td style="border:1px solid lightgrey; padding: 6px">{{ item.label }}</td>
          <td style="border:1px solid lightgrey; padding: 6px" [innerHTML]="renderMarked(item.from)"></td>
          <td style="border:1px solid lightgrey; padding: 6px" [innerHTML]="renderMarked(item.to) "></td>
        </tr>
      }
    </table>
  `,
    imports: []
})
export class WalkNotificationChangesComponent extends WalkNotificationDetailsComponent {

}
