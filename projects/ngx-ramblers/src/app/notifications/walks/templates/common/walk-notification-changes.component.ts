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
        <ng-container *ngIf="!renderMarkdown">
          <td style="border:1px solid lightgrey; padding: 6px">{{ item.previousValue }}</td>
          <td style="border:1px solid lightgrey; padding: 6px">{{ item.currentValue }}</td>
        </ng-container>
        <ng-container *ngIf="renderMarkdown">
          <td style="border:1px solid lightgrey; padding: 6px"
              markdown [data]="item.previousValue"></td>
          <td style="border:1px solid lightgrey; padding: 6px"
              markdown [data]="item.currentValue"></td>
        </ng-container>
      </tr>
    </table>
  `
})
export class WalkNotificationChangesComponent extends WalkNotificationDetailsComponent {
  protected renderMarkdown = true;
}
