import { Component } from "@angular/core";
import { ExpenseNotificationDetailsComponent } from "../common/expense-notification-details.component";
import { ExpenseNotificationFooterComponent } from "../common/expense-notification-footer-component";
import { DisplayDatePipe } from "../../../../pipes/display-date.pipe";
import { MemberIdToFullNamePipe } from "../../../../pipes/member-id-to-full-name.pipe";

@Component({
    selector: "app-expense-notification-approver-second-approval",
    template: `
    <p>This email is to notify you as an Expense Approver, that <strong
      [textContent]="display.expenseClaimLatestEvent(expenseClaim).memberId | memberIdToFullName : members"></strong>
      has just updated <strong
        [textContent]="(display.expenseClaimCreatedEvent(expenseClaim).memberId | memberIdToFullName : members) + '\\'s'"></strong>
      {{ group?.shortName }} expense claim to <strong
        [textContent]="display.eventTypeDisplayDescription(display.expenseClaimLatestEvent(expenseClaim).eventType)"></strong>.
      For reference, the claim was originally created on <span
        [textContent]="display.expenseClaimCreatedEvent(expenseClaim).date | displayDate"></span>
      and contains the following {{ stringUtilsService.pluraliseWithCount(expenseClaim.expenseItems.length, 'item') }}:
    </p>
    <app-expense-notification-details [expenseClaim]="expenseClaim"></app-expense-notification-details>
    <p>If this payment is waiting in Unity, authorise it at
      <a [href]="display.unityAwaitingAuthorisationUrl" target="_blank">Awaiting authorisation</a>,
      then mark <strong>{{ display.authorisedInUnityLabel }}</strong> on the expenses screen so the claimant is told the money is on the way.</p>
    <app-expense-notification-footer [expenseClaim]="expenseClaim"></app-expense-notification-footer>
  `,
    imports: [ExpenseNotificationDetailsComponent, ExpenseNotificationFooterComponent, DisplayDatePipe, MemberIdToFullNamePipe]
})
export class ExpenseNotificationApproverSecondApprovalComponent extends ExpenseNotificationDetailsComponent {
}
