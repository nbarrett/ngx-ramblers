import { Component } from "@angular/core";
import { ExpenseNotificationDetailsComponent } from "../common/expense-notification-details.component";
import { ExpenseNotificationFooterComponent } from "../common/expense-notification-footer-component";
import { DisplayDatePipe } from "../../../../pipes/display-date.pipe";
import { MemberIdToFullNamePipe } from "../../../../pipes/member-id-to-full-name.pipe";

@Component({
    selector: "app-expense-notification-approver-submitted",
    template: `
    <p>This email is to notify you as an Expense Approver, that <strong
      [textContent]="display.expenseClaimCreatedEvent(expenseClaim).memberId | memberIdToFullName : members"></strong>
      has just submitted a new {{ group?.shortName }} expense claim. For reference, the claim was originally created on
      <span [textContent]="display.expenseClaimCreatedEvent(expenseClaim).date | displayDate"></span>
      and contains the following {{stringUtilsService.pluraliseWithCount(expenseClaim.expenseItems.length,'item')}}:</p>
    <app-expense-notification-details [expenseClaim]="expenseClaim"></app-expense-notification-details>
    <app-expense-notification-footer [expenseClaim]="expenseClaim"></app-expense-notification-footer>`,
    imports: [ExpenseNotificationDetailsComponent, ExpenseNotificationFooterComponent, DisplayDatePipe, MemberIdToFullNamePipe]
})
export class ExpenseNotificationApproverSubmittedComponent extends ExpenseNotificationDetailsComponent {

}
