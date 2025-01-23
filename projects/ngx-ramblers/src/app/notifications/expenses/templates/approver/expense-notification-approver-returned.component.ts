import { Component } from "@angular/core";
import { ExpenseNotificationDetailsComponent } from "../common/expense-notification-details.component";
import { ExpenseNotificationFooterComponent } from "../common/expense-notification-footer-component";
import { MemberIdToFullNamePipe } from "../../../../pipes/member-id-to-full-name.pipe";

@Component({
    selector: "app-expense-notification-approver-returned",
    template: `
    <p>This email is to notify you as an Expense Approver, that <strong
    [textContent]="display.expenseClaimLatestEvent(expenseClaim).memberId | memberIdToFullName : members"></strong>
    has just returned <strong
    [textContent]="(display.expenseClaimCreatedEvent(expenseClaim).memberId | memberIdToFullName : members) + '\\'s'"></strong>
    {{ group?.shortName }} expense claim as follows:
    </p>
    <app-expense-notification-details [expenseClaim]="expenseClaim"></app-expense-notification-details>
    <br>
      @if (display.expenseClaimLatestEvent(expenseClaim).reason) {
        <p>The reason given was as follows: <span
        [textContent]="display.expenseClaimLatestEvent(expenseClaim).reason"></span>.</p>
      }
      <app-expense-notification-footer [expenseClaim]="expenseClaim"></app-expense-notification-footer>`,
    imports: [ExpenseNotificationDetailsComponent, ExpenseNotificationFooterComponent, MemberIdToFullNamePipe]
})
export class ExpenseNotificationApproverReturnedComponent extends ExpenseNotificationDetailsComponent {

}
