import { Directive, Type, ViewContainerRef } from "@angular/core";
import { SocialNotificationDetailsComponent } from "./templates/social-notification-details.component";

@Directive({
  selector: "[app-social-notification-template]",
})
export class SocialNotificationDirective {
  constructor(public viewContainerRef: ViewContainerRef) {
  }
}

export class SocialNotificationComponentAndData {
  constructor(public component: Type<SocialNotificationDetailsComponent>) {
  }
}

