import { NgModule } from "@angular/core";
import { RouterModule } from "@angular/router";
import { hasDynamicPathAndNonNumericLastPathSegment } from "../../services/path-matchers";

@NgModule({
  imports: [RouterModule.forChild([
    {
      path: "send-notification/:committee-event-id",
      loadComponent: () => import("../../pages/committee/send-notification/committee-send-notification.component")
        .then(m => m.CommitteeSendNotificationComponent)
    },
    {
      path: "send-notification",
      loadComponent: () => import("../../pages/committee/send-notification/committee-send-notification.component")
        .then(m => m.CommitteeSendNotificationComponent)
    },
    {
      matcher: hasDynamicPathAndNonNumericLastPathSegment,
      loadComponent: () => import("../common/dynamic-content-page/dynamic-content-page")
        .then(m => m.DynamicContentPageComponent)
    },
    {
      path: "**",
      loadComponent: () => import("../../pages/committee/home/committee-home.component")
        .then(m => m.CommitteeHomeComponent)
    }
  ])]
})
export class CommitteeRoutingModule {
}
