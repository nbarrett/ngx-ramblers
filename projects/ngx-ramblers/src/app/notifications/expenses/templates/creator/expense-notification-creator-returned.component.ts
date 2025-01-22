import { Component } from "@angular/core";
import { ExpenseNotificationDetailsComponent } from "../common/expense-notification-details.component";

@Component({
  selector: "app-expense-notification-creator-returned",
  template: `
    <p>We are sorry to let you know that the {{ group?.shortName }} expense claim you created on {{display.expenseClaimCreatedEvent(expenseClaim).date | displayDate}}
      with the {{stringUtilsService.pluraliseWithCount(expenseClaim.expenseItems.length,'item')}} listed below has been returned to
      you:
    </p>
    <app-expense-notification-details [expenseClaim]="expenseClaim"></app-expense-notification-details>
    <p *ngIf="display.expenseClaimLatestEvent(expenseClaim).reason">The reason we can't process your expense claim is as
      follows: <span [textContent]="display.expenseClaimLatestEvent(expenseClaim).reason"></span>.</p>
    <app-expense-notification-footer [expenseClaim]="expenseClaim"></app-expense-notification-footer>`,
  standalone: false
})
export class ExpenseNotificationCreatorReturnedComponent extends ExpenseNotificationDetailsComponent {

}
