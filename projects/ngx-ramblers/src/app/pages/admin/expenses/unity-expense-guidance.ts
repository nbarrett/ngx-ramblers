import { Component, Input, inject } from "@angular/core";
import { AlertPanelVariant } from "../../../models/alert-panel.model";
import { UnityExpenseGuidanceMode } from "../../../models/expense-claim.model";
import { AlertPanelComponent } from "../../../modules/common/alert-panel/alert-panel";
import { ExpenseDisplayService } from "../../../services/expenses/expense-display.service";

@Component({
  selector: "app-unity-expense-guidance",
  imports: [AlertPanelComponent],
  styles: [`
    .unity-expense-overview
      padding-left: 0
      margin-left: 0
      margin-bottom: 0
    .unity-expense-overview ul
      padding-left: 0
      margin: 0
      list-style: none
  `],
  template: `
    @if (mode === UnityExpenseGuidanceMode.OVERVIEW) {
      <div class="list-arrow unity-expense-overview">
        <ul>
          <li>NGX has no connection to Unity Trust Bank. This page is only a request and an audit trail of who approved a claim. Every payment has to be created and authorised by hand in Unity.</li>
          <li>After a claim is submitted, the first authorised person creates the payment at
            <a [href]="display.unityNewPaymentUrl" target="_blank" rel="noopener">Make a payment or transfer</a>,
            then marks <strong>{{ display.paymentCreatedInUnityLabel }}</strong> here.</li>
          <li>The other authorised person opens
            <a [href]="display.unityAwaitingAuthorisationUrl" target="_blank" rel="noopener">Awaiting authorisation</a>
            and authorises that payment.</li>
          <li>Only then mark <strong>{{ display.authorisedInUnityLabel }}</strong> here, so the claimant is told the payment has been sent. NGX does not send the money.</li>
        </ul>
      </div>
    } @else if (mode === UnityExpenseGuidanceMode.CREATE_PAYMENT) {
      <app-alert-panel title="Create the Unity payment first" [variant]="AlertPanelVariant.WARNING">
        <p class="mb-2">NGX has no connection to Unity. Confirming only records this step. Create the payment yourself at
          <a [href]="display.unityNewPaymentUrl" target="_blank" rel="noopener">Make a payment or transfer</a>
          first. That emails the other authorised person to authorise it at
          <a [href]="display.unityAwaitingAuthorisationUrl" target="_blank" rel="noopener">Awaiting authorisation</a>.</p>
        <p class="mb-0">Do not mark <strong>{{ display.paymentCreatedInUnityLabel }}</strong> until that Unity payment exists.</p>
      </app-alert-panel>
    } @else {
      <app-alert-panel title="Authorise the Unity payment first" [variant]="AlertPanelVariant.WARNING">
        <p class="mb-2">NGX has no connection to Unity. Confirming only records this step. Authorise the payment yourself at
          <a [href]="display.unityAwaitingAuthorisationUrl" target="_blank" rel="noopener">Awaiting authorisation</a>
          first. That is what releases the money.</p>
        <p class="mb-0">Then mark <strong>{{ display.authorisedInUnityLabel }}</strong> here so the claimant is told it has been sent.</p>
      </app-alert-panel>
    }
  `
})
export class UnityExpenseGuidanceComponent {
  display = inject(ExpenseDisplayService);
  @Input() mode: UnityExpenseGuidanceMode = UnityExpenseGuidanceMode.OVERVIEW;
  protected readonly UnityExpenseGuidanceMode = UnityExpenseGuidanceMode;
  protected readonly AlertPanelVariant = AlertPanelVariant;
}
