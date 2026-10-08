import { Component } from "@angular/core";
import { ExpenseNotificationDetailsComponent } from "./expense-notification-details.component";

@Component({
  selector: "app-expense-notification-unity-steps",
  template: `
    <p>Ramblers groups pay expenses from Unity Trust Bank, which needs two authorised people:</p>
    <ol>
      <li>Create the payment at <a [href]="display.unityNewPaymentUrl" target="_blank">Make a payment or transfer</a>,
        then mark <strong>{{ display.paymentCreatedInUnityLabel }}</strong> on the expenses screen.</li>
      <li>The other authorised person opens <a [href]="display.unityAwaitingAuthorisationUrl" target="_blank">Awaiting authorisation</a>
        and authorises the payment.</li>
      <li>Once Unity has released the payment, mark <strong>{{ display.authorisedInUnityLabel }}</strong> on the expenses screen.
        That is when the money moves.</li>
    </ol>
  `
})
export class ExpenseNotificationUnityStepsComponent extends ExpenseNotificationDetailsComponent {
}
