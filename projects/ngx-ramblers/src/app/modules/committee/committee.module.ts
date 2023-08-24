import { NgModule } from "@angular/core";
import { CommitteeNotificationDirective } from "../../notifications/committee/committee-notification.directive";
import { CommitteeNotificationDetailsComponent } from "../../notifications/committee/templates/committee-notification-details.component";
import { CommitteeEditFileModalComponent } from "../../pages/committee/edit/committee-edit-file-modal.component";
import { CommitteeHomeComponent } from "../../pages/committee/home/committee-home.component";
import { CommitteeSendNotificationComponent } from "../../pages/committee/send-notification/committee-send-notification.component";
import { CommitteeYearComponent } from "../../pages/committee/year/committee-year";
import { SharedModule } from "../../shared-module";

@NgModule({
  declarations: [
    CommitteeSendNotificationComponent,
    CommitteeNotificationDetailsComponent,
    CommitteeYearComponent,
    CommitteeEditFileModalComponent,
    CommitteeHomeComponent,
    CommitteeNotificationDirective,
  ],
  imports: [
    SharedModule,
  ],
  providers: [
  ]
})
export class CommitteeModule {
}
