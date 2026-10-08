import { Component } from "@angular/core";
import { ExpenseNotificationDetailsComponent } from "./expense-notification-details.component";

@Component({
  selector: "app-expense-notification-unity-steps",
  template: `
    <p>NGX has no connection to Unity Trust Bank. This is only a request and an audit trail. Every payment has to be created and authorised by hand in Unity, which needs two authorised people:</p>
    <ol>
      <li>Create the payment at <a [href]="display.unityNewPaymentUrl" target="_blank">Make a payment or transfer</a>,
        then mark <strong>{{ display.paymentCreatedInUnityLabel }}</strong> on the expenses screen.</li>
      <li>The other authorised person opens <a [href]="display.unityAwaitingAuthorisationUrl" target="_blank">Awaiting authorisation</a>
        and authorises the payment.</li>
      <li>Once Unity has released the payment, mark <strong>{{ display.authorisedInUnityLabel }}</strong> on the expenses screen
        so the claimant is told it has been sent. NGX does not send the money.</li>
    </ol>
  `
})
export class ExpenseNotificationUnityStepsComponent extends ExpenseNotificationDetailsComponent {
}
