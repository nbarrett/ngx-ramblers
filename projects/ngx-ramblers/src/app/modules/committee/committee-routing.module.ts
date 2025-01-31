import { NgModule } from "@angular/core";
import { RouterModule } from "@angular/router";
import { hasDynamicPathAndNonNumericLastPathSegment } from "../../services/path-matchers";
import { CommitteeAuthGuard } from "../../guards/committee-auth-guard";

@NgModule({
  imports: [RouterModule.forChild([
    {
      path: "send-notification/:committee-event-id",
      loadComponent: () => import("../../pages/committee/send-notification/committee-send-notification.component")
        .then(m => m.CommitteeSendNotificationComponent), canActivate: [CommitteeAuthGuard]
    },
    {
      path: "send-notification",
      loadComponent: () => import("../../pages/committee/send-notification/committee-send-notification.component")
        .then(m => m.CommitteeSendNotificationComponent), canActivate: [CommitteeAuthGuard]
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
