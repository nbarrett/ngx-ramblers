import { Component } from "@angular/core";
import { ExpenseNotificationDetailsComponent } from "../common/expense-notification-details.component";
import { BuiltInRole } from "../../../../models/committee.model";
import { ExpenseNotificationFooterComponent } from "../common/expense-notification-footer-component";
import { DisplayDatePipe } from "../../../../pipes/display-date.pipe";
import { MemberIdToFirstNamePipe } from "../../../../pipes/member-id-to-first-name.pipe";
import { MemberIdToFullNamePipe } from "../../../../pipes/member-id-to-full-name.pipe";

@Component({
    selector: "app-expense-notification-approver-first-approval",
    template: `<p>This email is to notify you as an Expense Approver, that <strong
    [textContent]="display.expenseClaimLatestEvent(expenseClaim).memberId | memberIdToFullName : members"></strong>
    has just updated <strong
      [textContent]="(display.expenseClaimCreatedEvent(expenseClaim).memberId | memberIdToFullName : members) + '\\'s'"></strong>
    {{ group?.shortName }} expense claim to a status of <strong
      [textContent]="display.expenseClaimLatestEvent(expenseClaim).eventType.description"></strong>.
    For reference, the claim was originally created on {{display.expenseClaimCreatedEvent(expenseClaim).date | displayDate}}
    and contains the following {{stringUtilsService.pluraliseWithCount(expenseClaim.expenseItems.length,'item')}}:
  </p>
  <app-expense-notification-details [expenseClaim]="expenseClaim"></app-expense-notification-details>
  <p>Because an {{ group?.shortName }} expense claim needs 2 stages of approval, it will now need to be approved by a
    different person (e.g. not {{display.expenseClaimLatestEvent(expenseClaim).memberId | memberIdToFirstName : members}}).
    Then {{ display.committeeReferenceData.contactUsFieldForBuiltInRole(BuiltInRole.TREASURER, "fullName") }} will be automatically notified to organise the payment.</p>
  <app-expense-notification-footer [expenseClaim]="expenseClaim"></app-expense-notification-footer>
  `,
    imports: [ExpenseNotificationDetailsComponent, ExpenseNotificationFooterComponent, DisplayDatePipe, MemberIdToFirstNamePipe, MemberIdToFullNamePipe]
})
export class ExpenseNotificationApproverFirstApprovalComponent extends ExpenseNotificationDetailsComponent {
  protected readonly BuiltInRole = BuiltInRole;
}
