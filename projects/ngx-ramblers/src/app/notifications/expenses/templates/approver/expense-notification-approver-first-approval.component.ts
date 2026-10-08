import { Component } from "@angular/core";
import { ExpenseNotificationDetailsComponent } from "../common/expense-notification-details.component";
import { ExpenseNotificationFooterComponent } from "../common/expense-notification-footer-component";
import { ExpenseNotificationUnityStepsComponent } from "../common/expense-notification-unity-steps.component";
import { DisplayDatePipe } from "../../../../pipes/display-date.pipe";
import { MemberIdToFirstNamePipe } from "../../../../pipes/member-id-to-first-name.pipe";
import { MemberIdToFullNamePipe } from "../../../../pipes/member-id-to-full-name.pipe";

@Component({
    selector: "app-expense-notification-approver-first-approval",
    template: `<p>This email is to notify you as an Expense Approver, that <strong
    [textContent]="display.expenseClaimLatestEvent(expenseClaim).memberId | memberIdToFullName : members"></strong>
    has just updated <strong
      [textContent]="(display.expenseClaimCreatedEvent(expenseClaim).memberId | memberIdToFullName : members) + '\\'s'"></strong>
    {{ group?.shortName }} expense claim to <strong
      [textContent]="display.eventTypeDisplayDescription(display.expenseClaimLatestEvent(expenseClaim).eventType)"></strong>.
    For reference, the claim was originally created on {{display.expenseClaimCreatedEvent(expenseClaim).date | displayDate}}
    and contains the following {{stringUtilsService.pluraliseWithCount(expenseClaim.expenseItems.length,'item')}}:
  </p>
  <app-expense-notification-details [expenseClaim]="expenseClaim"></app-expense-notification-details>
  <p>A payment has been created in Unity. Please authorise it at
    <a [href]="display.unityAwaitingAuthorisationUrl" target="_blank">Awaiting authorisation</a>
    (someone other than {{display.expenseClaimLatestEvent(expenseClaim).memberId | memberIdToFirstName : members}}).
    After Unity has released the payment, mark <strong>{{ display.authorisedInUnityLabel }}</strong> on the expenses screen.</p>
  <app-expense-notification-unity-steps></app-expense-notification-unity-steps>
  <app-expense-notification-footer [expenseClaim]="expenseClaim"></app-expense-notification-footer>
  `,
    imports: [ExpenseNotificationDetailsComponent, ExpenseNotificationFooterComponent, ExpenseNotificationUnityStepsComponent, DisplayDatePipe, MemberIdToFirstNamePipe, MemberIdToFullNamePipe]
})
export class ExpenseNotificationApproverFirstApprovalComponent extends ExpenseNotificationDetailsComponent {
}
