import { Component, Input, inject } from "@angular/core";
import { AlertPanelVariant } from "../../../models/alert-panel.model";
import { UnityExpenseGuidanceMode } from "../../../models/expense-claim.model";
import { AlertPanelComponent } from "../../../modules/common/alert-panel/alert-panel";
import { ThumbnailHeadingFrameComponent } from "../../../modules/common/thumbnail-heading-frame/thumbnail-heading-frame";
import { VendorBrandMarkComponent } from "../../../modules/common/vendor-brand-mark/vendor-brand-mark.component";
import { ExpenseDisplayService } from "../../../services/expenses/expense-display.service";

@Component({
  selector: "app-unity-expense-guidance",
  imports: [AlertPanelComponent, ThumbnailHeadingFrameComponent, VendorBrandMarkComponent],
  template: `
    @if (mode === UnityExpenseGuidanceMode.OVERVIEW) {
      <app-thumbnail-heading-frame heading="Paying expenses in Unity" [compact]="true">
        <div class="d-flex align-items-start gap-3 flex-wrap">
          <app-vendor-brand-mark class="flex-shrink-0" brandKey="unityTrustBank" [sizePx]="40" [wide]="true"/>
          <div>
            <p class="mb-2">Ramblers groups pay expenses from Unity Trust Bank. Two authorised people are needed, and the stages on this screen must wait until the matching Unity work is done.</p>
            <ol class="mb-0 ps-3">
              <li>After a claim is submitted, the first authorised person creates the payment at
                <a [href]="display.unityNewPaymentUrl" target="_blank" rel="noopener">Make a payment or transfer</a>,
                then marks <strong>{{ display.paymentCreatedInUnityLabel }}</strong> here.</li>
              <li>The other authorised person opens
                <a [href]="display.unityAwaitingAuthorisationUrl" target="_blank" rel="noopener">Awaiting authorisation</a>
                and authorises that payment.</li>
              <li>Only then mark <strong>{{ display.authorisedInUnityLabel }}</strong> here. That is when the money moves.</li>
            </ol>
          </div>
        </div>
      </app-thumbnail-heading-frame>
    } @else if (mode === UnityExpenseGuidanceMode.CREATE_PAYMENT) {
      <app-alert-panel title="Create the Unity payment first" [variant]="AlertPanelVariant.WARNING">
        <p class="mb-2">Only continue after you have created this payment in Unity at
          <a [href]="display.unityNewPaymentUrl" target="_blank" rel="noopener">Make a payment or transfer</a>.
          Confirming now emails the other authorised person to authorise it at
          <a [href]="display.unityAwaitingAuthorisationUrl" target="_blank" rel="noopener">Awaiting authorisation</a>.</p>
        <p class="mb-0">Do not mark <strong>{{ display.paymentCreatedInUnityLabel }}</strong> until that Unity payment exists.</p>
      </app-alert-panel>
    } @else {
      <app-alert-panel title="Authorise the Unity payment first" [variant]="AlertPanelVariant.WARNING">
        <p class="mb-2">Only continue after the second authorised person has authorised this payment in Unity at
          <a [href]="display.unityAwaitingAuthorisationUrl" target="_blank" rel="noopener">Awaiting authorisation</a>.</p>
        <p class="mb-0">That Unity step releases the money. Then mark <strong>{{ display.authorisedInUnityLabel }}</strong> here so the claimant is told it is on the way.</p>
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
