import { NgModule } from "@angular/core";
import { SocialNotificationDirective } from "../../notifications/social/social-notification.directive";
import { SocialNotificationDetailsComponent } from "../../notifications/social/templates/social-notification-details.component";
import { SocialEditComponent } from "../../pages/social/edit/social-edit.component";
import { SocialHomeComponent } from "../../pages/social/home/social-home.component";
import { SocialInformationComponent } from "../../pages/social/information/social-information.component";
import { SocialCardComponent } from "../../pages/social/social-card/social-card";
import { SocialCarouselComponent } from "../../pages/social/social-carousel/social-carousel";
import { SocialSendNotificationModalComponent } from "../../pages/social/send-notification/social-send-notification-modal.component";
import { SocialDisplayService } from "../../pages/social/social-display.service";
import { SocialListCardsComponent } from "../../pages/social/social-list-cards/social-list-cards";
import { SocialListComponent } from "../../pages/social/social-list/social-list.component";
import { SocialSearchComponent } from "../../pages/social/social-search/social-search";
import { SocialViewComponent } from "../../pages/social/social-view/social-view";
import { SocialViewPageComponent } from "../../pages/social/social-view-page/social-view-page";
import { EventTimesPipe } from "../../pipes/event-times.pipe";
import { SharedModule } from "../../shared-module";

@NgModule({
  declarations: [
    EventTimesPipe,
    SocialCardComponent,
    SocialCarouselComponent,
    SocialEditComponent,
    SocialHomeComponent,
    SocialInformationComponent,
    SocialListCardsComponent,
    SocialListComponent,
    SocialNotificationDetailsComponent,
    SocialNotificationDirective,
    SocialSearchComponent,
    SocialSendNotificationModalComponent,
    SocialViewComponent,
    SocialViewPageComponent,
  ],
    imports: [
        SharedModule,
    ],
  providers: [
    SocialDisplayService
  ]
})
export class SocialModule {
}
