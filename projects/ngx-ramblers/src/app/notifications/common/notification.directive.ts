import { Directive, ViewContainerRef } from "@angular/core";

@Directive({
  selector: "[app-notification-directive]",
  standalone: false
})
export class NotificationDirective {
  constructor(public viewContainerRef: ViewContainerRef) {
  }
}
