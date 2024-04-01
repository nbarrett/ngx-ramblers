import { Component } from "@angular/core";
import { ExpenseNotificationDetailsComponent } from "../common/expense-notification-details.component";

@Component({
  selector: "app-expense-notification-treasurer-second-approval",
  template: `
    <p>This email is to notify you that <strong
      [textContent]="display.expenseClaimLatestEvent(expenseClaim).memberId | memberIdToFullName : members"></strong>
      has just updated <strong
        [textContent]="(display.expenseClaimCreatedEvent(expenseClaim).memberId | memberIdToFullName : members) + '\\'s'"
        ></strong>
      {{ group?.shortName }} expense claim to a status of <strong
        [textContent]="display.expenseClaimLatestEvent(expenseClaim).eventType.description"></strong>.
      For reference, the claim was originally created on <span
        [textContent]="display.expenseClaimCreatedEvent(expenseClaim).date | displayDate" ></span>
      and contains the following {{stringUtilsService.pluraliseWithCount(expenseClaim.expenseItems.length,'item')}}:
    </p>
    <app-expense-notification-details [expenseClaim]="expenseClaim"></app-expense-notification-details>
    <div *ngIf="expenseClaim.bankDetails">
      <p><span [textContent]="display.expenseClaimCreatedEvent(expenseClaim).memberId | memberIdToFullName : members"
               ></span> provided their bank details as follows:</p>
      <table
        style="cellpadding:10; border:1px solid lightgrey;border-collapse:collapse;width: 100%;border-spacing: 5px;">
        <thead>
        <tr>
          <th style="border:1px solid lightgrey; font-weight: bold; padding: 6px">Account Number</th>
          <th style="border:1px solid lightgrey; font-weight: bold; padding: 6px">Sort Code</th>
          <th style="border:1px solid lightgrey; font-weight: bold; padding: 6px">Account Name</th>
        </tr>
        </thead>
        <tbody>
        <tr>
          <td style="border:1px solid lightgrey; padding: 6px"
              [textContent]="expenseClaim.bankDetails.accountNumber"></td>
          <td style="border:1px solid lightgrey; padding: 6px" [textContent]="expenseClaim.bankDetails.sortCode"></td>
          <td style="border:1px solid lightgrey; padding: 6px"
              [textContent]="expenseClaim.bankDetails.accountName"></td>
        </tr>
        </tbody>
      </table>
    </div>
    <div *ngIf="!expenseClaim.bankDetails">
      <p><strong>Note: </strong><span
        [textContent]="display.expenseClaimCreatedEvent(expenseClaim).memberId | memberIdToFullName : members"
        ></span> chose not to provide their bank details when they submitted this claim, so a cheque will
        have to be raised for them.</p>
    </div>
    <p>Once you've organised the payment, please visit the link below and mark the expense as paid and then <span
      [textContent]="display.expenseClaimCreatedEvent(expenseClaim).memberId | memberIdToFullName : members"
      ></span> will be notified by email.</p>
    <app-expense-notification-footer [expenseClaim]="expenseClaim"></app-expense-notification-footer>`
})
export class ExpenseNotificationTreasurerSecondApprovalComponent extends ExpenseNotificationDetailsComponent {

}
