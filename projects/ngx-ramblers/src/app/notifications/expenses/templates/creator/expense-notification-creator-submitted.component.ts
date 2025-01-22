import { Component } from "@angular/core";
import { ExpenseNotificationDetailsComponent } from "../common/expense-notification-details.component";

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
    <p>Once your claim has been approved it will be paid. Please note that this can take a week or so to arrange as
      payments have to be approved by more than one committee member so please be patient with us!</p>
    <app-expense-notification-footer [expenseClaim]="expenseClaim"></app-expense-notification-footer>`,
  standalone: false
})
export class ExpenseNotificationCreatorSubmittedComponent extends ExpenseNotificationDetailsComponent {

}
