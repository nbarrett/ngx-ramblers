import { Directive, Type, ViewContainerRef } from "@angular/core";
import { CommitteeNotificationDetailsComponent } from "./templates/committee-notification-details.component";

@Directive({
  selector: "[app-committee-notification-template]",
})
export class CommitteeNotificationDirective {
  constructor(public viewContainerRef: ViewContainerRef) {
  }
}

export class CommitteeNotificationComponentAndData {
  constructor(public component: Type<CommitteeNotificationDetailsComponent>) {
  }
}

