import { Directive, inject, ViewContainerRef } from "@angular/core";

@Directive({ selector: "[app-notification-directive]" })
export class NotificationDirective {
  viewContainerRef = inject(ViewContainerRef);
}
