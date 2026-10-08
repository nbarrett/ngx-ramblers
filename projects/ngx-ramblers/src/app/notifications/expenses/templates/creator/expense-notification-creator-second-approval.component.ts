import { Component } from "@angular/core";
import { ExpenseNotificationDetailsComponent } from "../common/expense-notification-details.component";
import { ExpenseNotificationFooterComponent } from "../common/expense-notification-footer-component";
import { DisplayDatePipe } from "../../../../pipes/display-date.pipe";
import { MemberIdToFullNamePipe } from "../../../../pipes/member-id-to-full-name.pipe";

@Component({
    selector: "app-expense-notification-creator-second-approval",
    template: `
    <p>This email is to notify you that <strong
      [textContent]="display.expenseClaimLatestEvent(expenseClaim).memberId | memberIdToFullName : members"></strong>
      has just updated the expense claim you created on created on <span
        [textContent]="display.expenseClaimCreatedEvent(expenseClaim).date | displayDate" ></span>
      to <strong
        [textContent]="display.eventTypeDisplayDescription(display.expenseClaimLatestEvent(expenseClaim).eventType)"></strong>.
      For reference, the claim contains the following {{ stringUtilsService.pluraliseWithCount(expenseClaim.expenseItems.length, "item") }}:
    </p>
    <app-expense-notification-details [expenseClaim]="expenseClaim"></app-expense-notification-details>
    <p>The payment is being authorised in Unity Trust Bank. You will get another email once Unity has released the funds.</p>
    <app-expense-notification-footer [expenseClaim]="expenseClaim"></app-expense-notification-footer>`,
    imports: [ExpenseNotificationDetailsComponent, ExpenseNotificationFooterComponent, DisplayDatePipe, MemberIdToFullNamePipe]
})
export class ExpenseNotificationCreatorSecondApprovalComponent extends ExpenseNotificationDetailsComponent {
}
