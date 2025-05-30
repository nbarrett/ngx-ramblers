import { Component } from "@angular/core";
import { ExpenseNotificationDetailsComponent } from "../common/expense-notification-details.component";
import { ExpenseNotificationFooterComponent } from "../common/expense-notification-footer-component";
import { DisplayDatePipe } from "../../../../pipes/display-date.pipe";
import { MemberIdToFullNamePipe } from "../../../../pipes/member-id-to-full-name.pipe";

@Component({
    selector: "app-expense-notification-creator-paid",
    template: `
    <p>This email is just to confirm that the {{ group?.shortName }} expense claim you created on {{display.expenseClaimCreatedEvent(expenseClaim).date | displayDate}} with the
      {{stringUtilsService.pluraliseWithCount(expenseClaim.expenseItems.length,'item')}} listed below has been paid by <strong
        [textContent]="display.expenseClaimLatestEvent(expenseClaim).memberId | memberIdToFullName : members"></strong>:
    </p>
    <app-expense-notification-details [expenseClaim]="expenseClaim"></app-expense-notification-details>
    <p>You should see funds arriving of your bank account within the next 3 days.</p>
    <app-expense-notification-footer [expenseClaim]="expenseClaim"></app-expense-notification-footer>`,
    imports: [ExpenseNotificationDetailsComponent, ExpenseNotificationFooterComponent, DisplayDatePipe, MemberIdToFullNamePipe]
})
export class ExpenseNotificationCreatorPaidComponent extends ExpenseNotificationDetailsComponent {

}
