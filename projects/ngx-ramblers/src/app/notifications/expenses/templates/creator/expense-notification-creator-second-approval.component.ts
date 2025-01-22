import { Component } from "@angular/core";
import { ExpenseNotificationDetailsComponent } from "../common/expense-notification-details.component";
import { BuiltInRole } from "../../../../models/committee.model";

@Component({
  selector: "app-expense-notification-creator-second-approval",
  template: `
    <p>This email is to notify you that <strong
      [textContent]="display.expenseClaimLatestEvent(expenseClaim).memberId | memberIdToFullName : members"></strong>
      has just updated the expense claim you created on created on <span
        [textContent]="display.expenseClaimCreatedEvent(expenseClaim).date | displayDate" ></span>
      to a status of <strong
        [textContent]="display.expenseClaimLatestEvent(expenseClaim).eventType.description"></strong>.
      For reference, the claim contains the following <span [textContent]="expenseClaim.expenseItems.length"></span>
      item(s):
    </p>
    <app-expense-notification-details [expenseClaim]="expenseClaim"></app-expense-notification-details>
    <p>Our Treasurer {{ display.committeeReferenceData.contactUsFieldForBuiltInRole(BuiltInRole.TREASURER, "fullName") }} has also been
      notified about this, so should now be able to process the payment, and you'll
      hear from them next via email.</p>
    <app-expense-notification-footer [expenseClaim]="expenseClaim"></app-expense-notification-footer>`,
  standalone: false
})
export class ExpenseNotificationCreatorSecondApprovalComponent extends ExpenseNotificationDetailsComponent {
  protected readonly BuiltInRole = BuiltInRole;
}
