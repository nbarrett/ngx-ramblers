import { Component } from "@angular/core";
import { ExpenseNotificationDetailsComponent } from "../common/expense-notification-details.component";

@Component({
  selector: "app-expense-notification-approver-second-approval",
  template: `
    <p>This email is to notify you as an Expense Approver, that <strong
      [textContent]="display.expenseClaimLatestEvent(expenseClaim).memberId | memberIdToFullName : members"></strong>
      has just updated <strong
        [textContent]="(display.expenseClaimCreatedEvent(expenseClaim).memberId | memberIdToFullName : members) + '\\'s'"></strong>
      {{ group?.shortName }} expense claim to a status of <strong
        [textContent]="display.expenseClaimLatestEvent(expenseClaim).eventType.description"></strong>.
      For reference, the claim was originally created on <span
        [textContent]="display.expenseClaimCreatedEvent(expenseClaim).date | displayDate"></span>
      and contains the following {{ stringUtilsService.pluraliseWithCount(expenseClaim.expenseItems.length, 'item') }}:
    </p>
    <app-expense-notification-details [expenseClaim]="expenseClaim"></app-expense-notification-details>
    <p>Our Treasurer {{ display.committeeReferenceData.contactUsField("treasurer", "fullName") }} has also been notified
      about this, so should now be able to process the payment.</p>
    <app-expense-notification-footer [expenseClaim]="expenseClaim"></app-expense-notification-footer>
  `
})
export class ExpenseNotificationApproverSecondApprovalComponent extends ExpenseNotificationDetailsComponent {

}
