import { Directive, Type, ViewContainerRef } from "@angular/core";
import { ExpenseClaim } from "./expense.model";
import { ExpenseNotificationDetailsComponent } from "./templates/common/expense-notification-details.component";

@Directive({
  selector: "[app-expense-notification-template]",
})
export class ExpenseNotificationDirective {
  constructor(public viewContainerRef: ViewContainerRef) {
  }
}

export class ExpenseNotificationComponentAndData {
  constructor(public component: Type<ExpenseNotificationDetailsComponent>,
              public data: ExpenseClaim) {
  }
}

