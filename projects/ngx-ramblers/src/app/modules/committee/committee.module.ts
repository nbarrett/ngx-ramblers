import { NgModule } from "@angular/core";
import {
  CommitteeNotificationDetailsComponent
} from "../../notifications/committee/templates/committee-notification-details.component";
import { CommitteeEditFileModalComponent } from "../../pages/committee/edit/committee-edit-file-modal.component";
import { CommitteeHomeComponent } from "../../pages/committee/home/committee-home.component";
import {
  CommitteeSendNotificationComponent
} from "../../pages/committee/send-notification/committee-send-notification.component";
import { CommitteeYearComponent } from "../../pages/committee/year/committee-year";
import { SharedModule } from "../../shared-module";
import {
  CommitteeNotificationRamblersMessageItemComponent
} from "../../notifications/committee/templates/committee-notification-ramblers-message-item";
import {
  CommitteeNotificationGroupEventMessageItemComponent
} from "../../notifications/committee/templates/committee-notification-group-event-message-item";

@NgModule({
  declarations: [
    CommitteeSendNotificationComponent,
    CommitteeNotificationDetailsComponent,
    CommitteeYearComponent,
    CommitteeEditFileModalComponent,
    CommitteeHomeComponent,
    CommitteeNotificationRamblersMessageItemComponent,
    CommitteeNotificationGroupEventMessageItemComponent,
    CommitteeNotificationDetailsComponent
  ],
  imports: [
    SharedModule,
  ],
  providers: [
  ]
})
export class CommitteeModule {
}
