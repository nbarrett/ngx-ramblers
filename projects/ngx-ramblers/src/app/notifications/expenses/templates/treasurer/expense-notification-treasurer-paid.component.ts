import { Component } from "@angular/core";
import { ExpenseNotificationDetailsComponent } from "../common/expense-notification-details.component";

@Component({
  selector: "app-expense-notification-treasurer-paid",
  template: `
    <p>This email is to notify you that <strong
      [textContent]="(display.expenseClaimCreatedEvent(expenseClaim).memberId | memberIdToFullName : members) + '\\'s'"
      ></strong>
      {{ group?.shortName }} expense claim is now complete and they have been sent a payment notification informing them
      that funds will arrive of their bank account within 3 days.
      <app-expense-notification-footer [expenseClaim]="expenseClaim"></app-expense-notification-footer>`,
  standalone: false
})
export class ExpenseNotificationTreasurerPaidComponent extends ExpenseNotificationDetailsComponent {

}
