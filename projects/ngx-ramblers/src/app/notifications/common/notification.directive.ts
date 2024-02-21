import { Directive, ViewContainerRef } from "@angular/core";

@Directive({
  selector: "[app-notification-directive]",
})
export class NotificationDirective {
  constructor(public viewContainerRef: ViewContainerRef) {
  }
}
