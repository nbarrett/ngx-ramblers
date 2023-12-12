import { NgModule } from "@angular/core";
import { RouterModule } from "@angular/router";
import { CommitteeHomeComponent } from "../../pages/committee/home/committee-home.component";
import {
  CommitteeSendNotificationComponent
} from "../../pages/committee/send-notification/committee-send-notification.component";
import { hasDynamicPathAndNonNumericLastPathSegment } from "../../services/path-matchers";
import { DynamicContentPageComponent } from "../common/dynamic-content-page/dynamic-content-page";
import { CommitteeModule } from "./committee.module";

@NgModule({
  imports: [CommitteeModule, RouterModule.forChild([
    {path: "send-notification/:committee-event-id", component: CommitteeSendNotificationComponent},
    {path: "send-notification", component: CommitteeSendNotificationComponent},
    {matcher: hasDynamicPathAndNonNumericLastPathSegment, component: DynamicContentPageComponent},
    {path: "**", component: CommitteeHomeComponent}
  ])]
})
export class CommitteeRoutingModule {
}
