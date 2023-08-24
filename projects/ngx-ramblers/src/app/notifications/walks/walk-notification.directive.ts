import { Directive, Type, ViewContainerRef } from "@angular/core";
import { WalkNotification } from "../../models/walk-notification.model";
import { WalkNotificationDetailsComponent } from "./templates/common/walk-notification-details.component";

@Directive({
  selector: "[app-walk-notification-template]",
})
export class WalkNotificationDirective {
  constructor(public viewContainerRef: ViewContainerRef) {
  }
}

export class WalkNotificationComponentAndData {
  constructor(public component: Type<WalkNotificationDetailsComponent>,
              public data: WalkNotification) {
  }
}

