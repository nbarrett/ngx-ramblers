import { Component } from "@angular/core";
import { ExpenseNotificationDetailsComponent } from "../common/expense-notification-details.component";

@Component({
  selector: "app-expense-notification-footer",
  template: `
    <p>Please click <a [href]="urlService.baseUrl() +'/admin/expenses/'+ expenseClaim.id" target="_blank">this link</a>
      to see the details of the above expense claim, or to make changes to it.</p>
    <p>Best regards</p>`,
  standalone: false
})
export class ExpenseNotificationFooterComponent extends ExpenseNotificationDetailsComponent {

}
