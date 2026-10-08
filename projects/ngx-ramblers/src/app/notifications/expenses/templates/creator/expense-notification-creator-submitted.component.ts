import { Component } from "@angular/core";
import { ExpenseNotificationDetailsComponent } from "../common/expense-notification-details.component";
import { ExpenseNotificationFooterComponent } from "../common/expense-notification-footer-component";
import { DisplayDatePipe } from "../../../../pipes/display-date.pipe";

@Component({
    selector: "app-expense-notification-creator-submitted",
    template: `
    <p>This email is just to confirm that the {{ group?.shortName }} expense claim you created
      on {{ display.expenseClaimCreatedEvent(expenseClaim).date | displayDate }} with
      the {{ stringUtilsService.pluraliseWithCount(expenseClaim.expenseItems.length, 'item') }} listed below has been
      submitted for
      approval:
    </p>
    <app-expense-notification-details [expenseClaim]="expenseClaim"></app-expense-notification-details>
    <p>Once your claim has been checked, two authorised committee members pay it by hand in Unity Trust Bank.
      NGX does not send the payment. That can take a few days, so please be patient with us.</p>
    <app-expense-notification-footer [expenseClaim]="expenseClaim"></app-expense-notification-footer>`,
    imports: [ExpenseNotificationDetailsComponent, ExpenseNotificationFooterComponent, DisplayDatePipe]
})
export class ExpenseNotificationCreatorSubmittedComponent extends ExpenseNotificationDetailsComponent {

}
